import { Node, TextNode } from "./parser";
import { isCharSpace } from "./tokenizer";

interface Style {
  display?: "none" | "inline" | "block";
  color?: string;
  "font-size"?: number;
  "margin-left"?: number;
  "margin-top"?: number;
  "margin-bottom"?: number;
  "font-weight"?: string;
  "text-decoration"?: string;
}

const FONT = "Times New Roman";

const defaultStyles = {
  "*": {
    display: "block",
  },
  title: {
    display: "none",
  },
  h1: {
    display: "block",
    "font-size": 32,
    "margin-top": 22,
    "margin-bottom": 22,
    "font-weight": "bold",
  },
  h2: {
    display: "block",
    "font-size": 24,
    "margin-top": 20,
    "margin-bottom": 20,
    "font-weight": "bold",
  },
  a: {
    display: "inline",
    color: "blue",
    "text-decoration": "underline",
  },
  p: {
    display: "block",
    "margin-top": 16,
    "margin-bottom": 16,
  },
  dl: {
    display: "block",
    "margin-top": 16,
    "margin-bottom": 16,
  },
  dt: { display: "block" },
  dd: {
    display: "block",
    "margin-left": 40,
  },
} satisfies Record<string, Style>;

interface TextNodeRenderInfo {
  // left: number;
  // top: number;
  // right: number;
  // bottom: number;
  text: string;
  size?: number;
  color?: string;
  weight?: string;
  underline?: boolean;
  parent: Node;
}

interface TextNodeRenderCtx {
  size?: number;
  color?: string;
  weight?: string;
  underline?: boolean;
}

// interface LayoutContext {
//   left: number;
//   top: number;
//   marginLeft: number;
//   marginTop: number;
//   color?: string;
//   weight?: string;
//   underline?: boolean;
//   previousCharacterWasSpace?: boolean;
// }
//
// type NodeStack = ({node : Node | TextNode, ctx : LayoutContext})[];

// interface Block {
//   left: number;
//   top: number;
//   width: number;
//   height: number;
//   marginLeft: number;
//   marginTop: number;
// }

interface Block2 {
  block: Node;
  style: Style;
  elements: TextNodeRenderInfo[];
}

const getStylesForTag = (tag: string) => {
  return defaultStyles[tag as keyof typeof defaultStyles] ?? defaultStyles["*"];
};

function generateBlocks(body: Node) {
  let block: Block2 = {
    block: body,
    style: getStylesForTag(body.tag),
    elements: [],
  };
  const blocks: Block2[] = [block];
  interface Stack {
    node: Node | TextNode;
    ctx: TextNodeRenderCtx;
  }
  const stack: Stack[] = [{ node: body, ctx: {} }];

  while (stack.length) {
    const { node, ctx } = stack.pop()!;

    if (!node.hasParent(block.block)) {
      block = {
        block: node.parent!,
        style: getStylesForTag(node.parent!.tag),
        elements: [],
      };
      blocks.push(block);
    }

    if (node instanceof Node) {
      const styles = getStylesForTag(node.tag);

      if (styles.display === "block") {
        block = { block: node, style: styles, elements: [] };
        blocks.push(block);
      } else if (styles.display === "none") {
        continue;
      }

      const newCtx = {
        ...ctx,
      };
      if ("font-size" in styles) {
        newCtx.size = styles["font-size"];
      }
      if ("color" in styles) {
        newCtx.color = styles.color;
      }
      if ("text-decoration" in styles) {
        newCtx.underline = styles["text-decoration"].includes("underline");
      }
      if ("font-weight" in styles) {
        newCtx.weight = styles["font-weight"];
      }

      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        stack.push({ node: node.childNodes[i], ctx: newCtx });
      }
    } else {
      block.elements.push({
        parent: node.parent,
        text: node.textContext,
        ...ctx,
      });
    }
  }

  // we'll normalize here as well. gotta get rid of any empty or
  // leading/trailing whitespace

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let shouldRemoveLeading = true;
    for (let i = 0; i < block.elements.length; i++) {
      const element = block.elements[i];
      if (shouldRemoveLeading) {
        element.text = element.text.replace(/^\s+/, "");
      }
      if (element.text.length === 0) {
      } else if (isCharSpace(element.text[element.text.length - 1])) {
        shouldRemoveLeading = true;
      } else {
        shouldRemoveLeading = false;
      }
    }

    for (let i = block.elements.length - 1; i >= 0; i--) {
      const element = block.elements[i];
      element.text = element.text.replace(/\s+$/, "");
      if (element.text.length) {
        break;
      }
    }
  }

  // now remove all empty blocks
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    block.elements = block.elements.filter((element) => element.text);
    if (block.elements.length === 0) {
      blocks.splice(i, 1);
      i--;
    }
  }

  return blocks;
}

const drawText = (
  ctx: CanvasRenderingContext2D,
  elements: TextNodeRenderInfo[],
  width: number,
  blockLeft: number,
  blockTop: number,
) => {
  const ratio = window.devicePixelRatio;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let left = blockLeft;
  let top = blockTop;
  let maxHeight = 0;
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const size = (element.size ?? 16) * ratio;
    ctx.font = `${element.weight ?? "normal"} ${size}px ${FONT}`;
    ctx.fillStyle = element.color ?? "black";
    ctx.strokeStyle = element.color ?? "black";
    maxHeight = Math.max(maxHeight, size);

    let textLeftToWrite = element.text;
    while (textLeftToWrite) {
      // just write one word at a time
      const index = textLeftToWrite.indexOf(" ");
      let text = "";
      if (index < 0) {
        text = textLeftToWrite;
        textLeftToWrite = "";
      } else {
        text = textLeftToWrite.slice(0, index + 1);
        textLeftToWrite = textLeftToWrite.slice(index + 1);
      }
      const measured = ctx.measureText(text);
      if (measured.width + left > width) {
        top += size;
        left = blockLeft;
      }
      ctx.fillText(text, left, top + size * 0.75);
      if (element.underline) {
        ctx.beginPath();
        ctx.moveTo(left, top + size * 0.9);
        ctx.lineTo(left + measured.width, top + size * 0.9);
        ctx.lineWidth = ratio;
        ctx.stroke();
      }
      left += measured.width;
    }
  }
  return top + maxHeight;
};

export const render = (canvas: HTMLCanvasElement, body: Node) => {
  const ratio = window.devicePixelRatio;
  const ctx = canvas.getContext("2d")!;
  const blocks = generateBlocks(body);
  const width = canvas.width;
  const globalMargin = 8;
  let previousMarginBottom = 8;
  let y = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const {
      "margin-top": marginTop,
      "margin-bottom": marginBottom,
      "margin-left": marginLeft,
    } = block.style;
    const actualMarginTop = Math.max(marginTop ?? 0, previousMarginBottom) * ratio;
    y += actualMarginTop;
    const actualMarginLeft = (globalMargin + (marginLeft ?? 0)) * ratio;

    y = drawText(ctx, block.elements, width, actualMarginLeft, y);
    previousMarginBottom = marginBottom ?? 0;
  }
};
