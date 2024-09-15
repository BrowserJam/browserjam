// src/tokenizer.ts
var isCharSpace = (string) => {
  return string === " " || string == "\n" || string === "\t" || string === "\f";
};
var isCharAlpha = (string) => {
  const charCode = string.charCodeAt(0);
  const a = "a".charCodeAt(0);
  const z = "z".charCodeAt(0);
  const A = "A".charCodeAt(0);
  const Z = "Z".charCodeAt(0);
  return charCode >= a && charCode <= z || charCode >= A && charCode <= Z;
};
class TokenizerContext {
  input;
  index;
  state;
  returnState = [];
  constructor(input, index, state) {
    this.input = input;
    this.index = index;
    this.state = state;
  }
  getRest() {
    return this.input.slice(this.index);
  }
  peek(length) {
    return this.input.slice(this.index, this.index + length);
  }
  startsWith(string) {
    return this.peek(string.length) === string;
  }
  skip(length = 1) {
    this.index += length;
  }
  consume() {
    const char = this.input[this.index];
    this.index += 1;
    return char;
  }
  eof() {
    return this.index >= this.input.length;
  }
  reconsume() {
    this.index -= 1;
  }
  setState(state, returnState) {
    if (returnState != null) {
      this.returnState.push(returnState);
    }
    this.state = state;
  }
  popReturnState() {
    this.state = this.returnState.pop();
  }
  *[Symbol.iterator]() {
    while (!this.eof()) {
      yield this.consume();
    }
  }
  clone() {
    const clone = new TokenizerContext(this.input, this.index, this.state);
    clone.returnState = this.returnState;
    return clone;
  }
  set(ctx) {
    this.returnState = ctx.returnState;
    this.input = ctx.input;
    this.index = ctx.index;
    this.state = ctx.state;
  }
}

// src/parser.ts
function* tokenizer2(input) {
  const s = new TokenizerContext(input, 0, 0 /* data */);
  let tagToken = generateEmptyTagToken(false);
  let attribute = ["", ""];
  let doctypeToken = generateDoctypeToken();
  while (!s.eof()) {
    const state = s.state;
    switch (state) {
      case 0 /* data */: {
        for (const char of s) {
          if (char === "<") {
            s.setState(1 /* tagOpen */);
            break;
          } else {
            yield generateCharacterToken(char);
          }
        }
        break;
      }
      case 1 /* tagOpen */: {
        const char = s.consume();
        if (char === "!") {
          s.setState(14 /* markupDeclarationOpen */);
        } else if (char === "/") {
          s.setState(2 /* endTagOpen */);
        } else if (isCharAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(false);
          s.setState(3 /* tagName */);
        } else {
          s.reconsume();
          s.setState(0 /* data */);
        }
        break;
      }
      case 2 /* endTagOpen */: {
        const char = s.consume();
        if (isCharAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(true);
          s.setState(3 /* tagName */);
        } else {
          s.reconsume();
          s.setState(13 /* bogusComment */);
        }
        break;
      }
      case 3 /* tagName */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(4 /* beforeAttributeName */);
            break;
          } else if (char === "/") {
            tagToken.selfClosing = true;
            s.setState(12 /* selfClosingStartTag */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            tagToken.name += char.toLowerCase();
          }
        }
        break;
      }
      case 4 /* beforeAttributeName */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else if (char === "/" || char === ">") {
            s.reconsume();
            s.setState(6 /* afterAttributeName */);
            break;
          } else if (char === "=") {
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(5 /* attributeName */);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case 5 /* attributeName */: {
        for (const char of s) {
          if (isCharSpace(char) || char === "/" || char === ">") {
            s.reconsume();
            s.setState(6 /* afterAttributeName */);
            break;
          } else if (char === "=") {
            s.setState(7 /* beforeAttributeValue */);
            break;
          } else {
            attribute[0] += char.toLowerCase();
          }
        }
        break;
      }
      case 6 /* afterAttributeName */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else if (char === "/") {
            s.setState(12 /* selfClosingStartTag */);
            break;
          } else if (char === "=") {
            s.setState(7 /* beforeAttributeValue */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(5 /* attributeName */);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case 7 /* beforeAttributeValue */: {
        for (const char2 of s) {
          if (isCharSpace(char2)) {
            continue;
          }
          s.reconsume();
          break;
        }
        const char = s.consume();
        if (char === '"') {
          s.setState(8 /* attributeValueDoubleQuoted */);
        } else if (char === "'") {
          s.setState(9 /* attributeValueSingleQuoted */);
        } else if (char === ">") {
          yield tagToken;
          s.setState(0 /* data */);
        } else {
          s.reconsume();
          s.setState(10 /* attributeValueUnquoted */);
        }
        break;
      }
      case 8 /* attributeValueDoubleQuoted */: {
        for (const char of s) {
          if (char === '"') {
            s.setState(11 /* afterAttributeValueQuoted */);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case 9 /* attributeValueSingleQuoted */: {
        for (const char of s) {
          if (char === "'") {
            s.setState(11 /* afterAttributeValueQuoted */);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case 10 /* attributeValueUnquoted */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(4 /* beforeAttributeName */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case 11 /* afterAttributeValueQuoted */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(4 /* beforeAttributeName */);
            break;
          } else if (char === "/") {
            s.setState(12 /* selfClosingStartTag */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            s.reconsume();
            s.setState(4 /* beforeAttributeName */);
            break;
          }
        }
        break;
      }
      case 12 /* selfClosingStartTag */: {
        const char = s.consume();
        if (char === ">") {
          tagToken.selfClosing = true;
          s.setState(0 /* data */);
        } else {
          s.reconsume();
          s.setState(17 /* beforeDoctypeName */);
        }
        break;
      }
      case 13 /* bogusComment */: {
        for (const char of s) {
          if (char === ">") {
            s.setState(0 /* data */);
            break;
          }
        }
        break;
      }
      case 14 /* markupDeclarationOpen */: {
        const doctype = "doctype";
        if (s.peek(doctype.length).toLowerCase() === doctype) {
          s.skip(doctype.length);
          s.setState(16 /* doctype */);
        } else if (s.peek(2) === "--") {
          s.skip(2);
          s.setState(15 /* comment */);
        }
        break;
      }
      case 15 /* comment */: {
        for (const char of s) {
          if (char === "-" && s.peek(2) === "->") {
            s.skip(2);
            s.setState(0 /* data */);
            break;
          }
        }
        break;
      }
      case 16 /* doctype */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(17 /* beforeDoctypeName */);
            break;
          } else {
            s.reconsume();
            s.setState(17 /* beforeDoctypeName */);
            break;
          }
        }
        break;
      }
      case 17 /* beforeDoctypeName */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else {
            s.reconsume();
            doctypeToken = generateDoctypeToken();
            s.setState(18 /* doctypeName */);
            break;
          }
        }
        break;
      }
      case 18 /* doctypeName */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(19 /* afterDoctypeName */);
            break;
          } else if (char === ">") {
            yield doctypeToken;
            s.setState(0 /* data */);
            break;
          } else {
            doctypeToken.doctype += char.toLowerCase();
          }
        }
        break;
      }
      case 19 /* afterDoctypeName */: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else if (char === ">") {
            s.setState(0 /* data */);
            yield doctypeToken;
            break;
          }
        }
        break;
      }
      default: {
        const _v = state;
      }
    }
  }
}
var generateCharacterToken = (character) => {
  return {
    type: 0 /* character */,
    character
  };
};
var generateEmptyTagToken = (closing) => {
  return {
    type: 1 /* tag */,
    name: "",
    closing,
    attributes: [],
    selfClosing: false
  };
};
var generateDoctypeToken = () => {
  return {
    type: 2 /* doctype */,
    doctype: ""
  };
};

class TextNode {
  parent;
  text;
  constructor(parent, text) {
    this.parent = parent;
    this.text = text;
  }
  get textContext() {
    return this.text.replace(/\s+/g, " ");
  }
  hasParent(node) {
    return this.parent.hasParent(node);
  }
  debug() {
    return this.text;
  }
  html(indent = 0) {
    return " ".repeat(indent) + this.textContext;
  }
}

class Node {
  tag;
  attributes;
  parent;
  childNodes = [];
  constructor(tag, attributes = {}, parent) {
    this.tag = tag;
    this.attributes = attributes;
    this.parent = parent;
  }
  hasParent(node) {
    let current = this;
    while (current) {
      if (node === current) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
  *visit() {
    for (let i = 0;i < this.childNodes.length; i++) {
      const node = this.childNodes[i];
      yield node;
      if (node instanceof Node) {
        for (const subnode of node.visit()) {
          yield subnode;
        }
      }
    }
  }
  *getElementsByTagname(tagname) {
    for (const node of this.visit()) {
      if (node instanceof Node && node.tag === tagname) {
        yield node;
      }
    }
  }
  debug() {
    const { parent, childNodes, ...rest } = this;
    return {
      ...rest,
      childNodes: childNodes.map((child) => child.debug())
    };
  }
  html(indent = 0) {
    const nextLevelIndent = this.tag === "" ? indent : indent + 2;
    const children = this.childNodes.map((node) => node.html(nextLevelIndent)).join("\n");
    if (this.tag === "") {
      return children;
    }
    let attributes = "";
    for (const [key, value] of Object.entries(this.attributes)) {
      attributes += " ";
      attributes += `${key}="${value}"`;
    }
    const indentation = " ".repeat(indent);
    return `${indentation}<${this.tag}${attributes}>\n${children}\n${indentation}</${this.tag}>`;
  }
}
var voidTags = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
];
var impliedEndTags = [
  "dd",
  "dt",
  "li",
  "optgroup",
  "option",
  "p",
  "rb",
  "rp",
  "rt",
  "rtc"
];
var generateImpliedEndTags = [...impliedEndTags, "dl"];
var parse = (input) => {
  const root = new Node("", {}, undefined);
  let node = root;
  const tokens = [...tokenizer2(input)];
  for (let i = 0;i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 2 /* doctype */: {
        break;
      }
      case 1 /* tag */: {
        if (token.closing) {
          let current = node;
          while (current) {
            if (token.name === current.tag) {
              console.assert(current.parent, "closed 1 too many nodes lol");
              node = current.parent;
              break;
            }
            current = current.parent;
          }
        } else {
          if (generateImpliedEndTags.includes(token.name)) {
            let current = node;
            while (current) {
              if (impliedEndTags.includes(current.tag)) {
                node = current.parent;
                break;
              }
              current = current.parent;
            }
          }
          const newNode = new Node(token.name, Object.fromEntries(token.attributes), node);
          node.childNodes.push(newNode);
          if (voidTags.includes(token.name)) {
          } else {
            node = newNode;
          }
        }
        break;
      }
      case 0 /* character */: {
        const textnode = new TextNode(node, "");
        while (i < tokens.length && tokens[i].type === 0 /* character */) {
          textnode.text += tokens[i].character;
          i += 1;
        }
        node.childNodes.push(textnode);
        i -= 1;
      }
    }
  }
  return root;
};

// src/renderer.ts
function generateBlocks(body) {
  let block = {
    block: body,
    style: getStylesForTag(body.tag),
    elements: []
  };
  const blocks = [block];
  const stack = [{ node: body, ctx: {} }];
  while (stack.length) {
    const { node, ctx } = stack.pop();
    if (!node.hasParent(block.block)) {
      block = {
        block: node.parent,
        style: getStylesForTag(node.parent.tag),
        elements: []
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
        ...ctx
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
      for (let i = node.childNodes.length - 1;i >= 0; i--) {
        stack.push({ node: node.childNodes[i], ctx: newCtx });
      }
    } else {
      block.elements.push({
        parent: node.parent,
        text: node.textContext,
        ...ctx
      });
    }
  }
  for (let i = 0;i < blocks.length; i++) {
    const block2 = blocks[i];
    let shouldRemoveLeading = true;
    for (let i2 = 0;i2 < block2.elements.length; i2++) {
      const element = block2.elements[i2];
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
    for (let i2 = block2.elements.length - 1;i2 >= 0; i2--) {
      const element = block2.elements[i2];
      element.text = element.text.replace(/\s+$/, "");
      if (element.text.length) {
        break;
      }
    }
  }
  for (let i = 0;i < blocks.length; i++) {
    const block2 = blocks[i];
    block2.elements = block2.elements.filter((element) => element.text);
    if (block2.elements.length === 0) {
      blocks.splice(i, 1);
      i--;
    }
  }
  return blocks;
}
var FONT = "Times New Roman";
var defaultStyles = {
  "*": {
    display: "block"
  },
  title: {
    display: "none"
  },
  h1: {
    display: "block",
    "font-size": 32,
    "margin-top": 22,
    "margin-bottom": 22,
    "font-weight": "bold"
  },
  h2: {
    display: "block",
    "font-size": 24,
    "margin-top": 20,
    "margin-bottom": 20,
    "font-weight": "bold"
  },
  a: {
    display: "inline",
    color: "blue",
    "text-decoration": "underline"
  },
  p: {
    display: "block",
    "margin-top": 16,
    "margin-bottom": 16
  },
  dl: {
    display: "block",
    "margin-top": 16,
    "margin-bottom": 16
  },
  dt: { display: "block" },
  dd: {
    display: "block",
    "margin-left": 40
  }
};
var getStylesForTag = (tag) => {
  return defaultStyles[tag] ?? defaultStyles["*"];
};
var drawText = (ctx, elements, width, blockLeft, blockTop) => {
  const ratio = window.devicePixelRatio;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let left = blockLeft;
  let top = blockTop;
  let maxHeight = 0;
  for (let i = 0;i < elements.length; i++) {
    const element = elements[i];
    const size = (element.size ?? 16) * ratio;
    ctx.font = `${element.weight ?? "normal"} ${size}px ${FONT}`;
    ctx.fillStyle = element.color ?? "black";
    ctx.strokeStyle = element.color ?? "black";
    maxHeight = Math.max(maxHeight, size);
    let textLeftToWrite = element.text;
    while (textLeftToWrite) {
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
var render = (canvas, body) => {
  const ratio = window.devicePixelRatio;
  const ctx = canvas.getContext("2d");
  const blocks = generateBlocks(body);
  const width = canvas.width;
  const globalMargin = 8;
  let previousMarginBottom = 8;
  let y = 0;
  for (let i = 0;i < blocks.length; i++) {
    const block = blocks[i];
    const {
      "margin-top": marginTop,
      "margin-bottom": marginBottom,
      "margin-left": marginLeft
    } = block.style;
    const actualMarginTop = Math.max(marginTop ?? 0, previousMarginBottom) * ratio;
    y += actualMarginTop;
    const actualMarginLeft = (globalMargin + (marginLeft ?? 0)) * ratio;
    y = drawText(ctx, block.elements, width, actualMarginLeft, y);
    previousMarginBottom = marginBottom ?? 0;
  }
};

// src/index.ts
async function fetchPage(url) {
  const proxied = `${PROXY_HOST}/${url}`;
  const resp = await fetch(proxied);
  const text = await resp.text();
  return text;
}
async function main() {
  const canvas = document.getElementById("canvas");
  const htmlDisplay = document.getElementById("inputhtml");
  const addressBar = document.getElementById("address-bar");
  let text;
  let html;
  async function resize() {
    if (canvas.parentElement) {
      const ratio = window.devicePixelRatio;
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = canvas.parentElement.clientWidth * ratio;
      canvas.height = canvas.parentElement.clientHeight * ratio;
    }
  }
  async function run() {
    text = await fetchPage(addressBar.value);
    html = parse(text);
    htmlDisplay.textContent = html.html();
    resize();
    render(canvas, html);
  }
  addressBar.addEventListener("blur", run);
  run();
}
var PROXY_HOST = window.location.href.includes("localhost") ? "http://localhost:8090" : "https://browser.mbkv.io/proxy";
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

//# debugId=DEF4859F2DC2F0E164756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3Rva2VuaXplci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9yZW5kZXJlci50cyIsICIuLi9zcmMvaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IGNvbnN0IGlzQ2hhclNwYWNlID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBzdHJpbmcgPT09IFwiIFwiIHx8IHN0cmluZyA9PSBcIlxcblwiIHx8IHN0cmluZyA9PT0gXCJcXHRcIiB8fCBzdHJpbmcgPT09IFwiXFxmXCI7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyRGlnaXQgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2hhckNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgemVybyA9IFwiMFwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IG5pbmUgPSBcIjlcIi5jaGFyQ29kZUF0KDApO1xuXG4gIHJldHVybiBjaGFyQ29kZSA+PSB6ZXJvICYmIGNoYXJDb2RlIDw9IG5pbmU7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyQWxwaGEgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2hhckNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgYSA9IFwiYVwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IHogPSBcInpcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBBID0gXCJBXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgWiA9IFwiWlwiLmNoYXJDb2RlQXQoMCk7XG5cbiAgcmV0dXJuIChjaGFyQ29kZSA+PSBhICYmIGNoYXJDb2RlIDw9IHopIHx8IChjaGFyQ29kZSA+PSBBICYmIGNoYXJDb2RlIDw9IFopO1xufTtcblxuZXhwb3J0IGNvbnN0IGlzQ2hhckhleCA9IChzdHJpbmc6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaGFyQ29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBhID0gXCJhXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgZiA9IFwiZlwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IEEgPSBcIkFcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBGID0gXCJGXCIuY2hhckNvZGVBdCgwKTtcblxuICByZXR1cm4gKFxuICAgIGlzQ2hhckRpZ2l0KHN0cmluZykgfHxcbiAgICAoY2hhckNvZGUgPj0gYSAmJiBjaGFyQ29kZSA8PSBmKSB8fFxuICAgIChjaGFyQ29kZSA+PSBBICYmIGNoYXJDb2RlIDw9IEYpXG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyQmFzZTY0ID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIHJldHVybiAoXG4gICAgaXNDaGFyQWxwaGEoc3RyaW5nKSB8fFxuICAgIGlzQ2hhckRpZ2l0KHN0cmluZykgfHxcbiAgICBzdHJpbmdbMF0gPT09IFwiX1wiIHx8XG4gICAgc3RyaW5nWzBdID09PSBcIi1cIlxuICApO1xufTtcblxuZXhwb3J0IGNsYXNzIFRva2VuaXplckNvbnRleHQ8U3RhdGU+IHtcbiAgcmV0dXJuU3RhdGU6IFN0YXRlW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgaW5wdXQ6IHN0cmluZyxcbiAgICBwdWJsaWMgaW5kZXg6IG51bWJlcixcbiAgICBwdWJsaWMgc3RhdGU6IFN0YXRlLFxuICApIHt9XG5cbiAgZ2V0UmVzdCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbnB1dC5zbGljZSh0aGlzLmluZGV4KTtcbiAgfVxuXG4gIHBlZWsobGVuZ3RoOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pbnB1dC5zbGljZSh0aGlzLmluZGV4LCB0aGlzLmluZGV4ICsgbGVuZ3RoKTtcbiAgfVxuXG4gIHN0YXJ0c1dpdGgoc3RyaW5nOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5wZWVrKHN0cmluZy5sZW5ndGgpID09PSBzdHJpbmc7XG4gIH1cblxuICBza2lwKGxlbmd0aCA9IDEpIHtcbiAgICB0aGlzLmluZGV4ICs9IGxlbmd0aDtcbiAgfVxuXG4gIGNvbnN1bWUoKSB7XG4gICAgY29uc3QgY2hhciA9IHRoaXMuaW5wdXRbdGhpcy5pbmRleF07XG4gICAgdGhpcy5pbmRleCArPSAxO1xuICAgIHJldHVybiBjaGFyO1xuICB9XG5cbiAgZW9mKCkge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMuaW5wdXQubGVuZ3RoO1xuICB9XG5cbiAgcmVjb25zdW1lKCkge1xuICAgIHRoaXMuaW5kZXggLT0gMTtcbiAgfVxuXG4gIHNldFN0YXRlKHN0YXRlOiBTdGF0ZSwgcmV0dXJuU3RhdGU/OiBTdGF0ZSkge1xuICAgIGlmIChyZXR1cm5TdGF0ZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnJldHVyblN0YXRlLnB1c2gocmV0dXJuU3RhdGUpO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gIH1cblxuICBwb3BSZXR1cm5TdGF0ZSgpIHtcbiAgICB0aGlzLnN0YXRlID0gdGhpcy5yZXR1cm5TdGF0ZS5wb3AoKSE7XG4gIH1cblxuICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgd2hpbGUgKCF0aGlzLmVvZigpKSB7XG4gICAgICB5aWVsZCB0aGlzLmNvbnN1bWUoKTtcbiAgICB9XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5ldyBUb2tlbml6ZXJDb250ZXh0KHRoaXMuaW5wdXQsIHRoaXMuaW5kZXgsIHRoaXMuc3RhdGUpO1xuICAgIGNsb25lLnJldHVyblN0YXRlID0gdGhpcy5yZXR1cm5TdGF0ZTtcbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICBzZXQoY3R4OiBUb2tlbml6ZXJDb250ZXh0PFN0YXRlPikge1xuICAgIHRoaXMucmV0dXJuU3RhdGUgPSBjdHgucmV0dXJuU3RhdGU7XG4gICAgdGhpcy5pbnB1dCA9IGN0eC5pbnB1dDtcbiAgICB0aGlzLmluZGV4ID0gY3R4LmluZGV4O1xuICAgIHRoaXMuc3RhdGUgPSBjdHguc3RhdGU7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgaXNDaGFyQWxwaGEsIGlzQ2hhclNwYWNlLCBUb2tlbml6ZXJDb250ZXh0IH0gZnJvbSBcIi4vdG9rZW5pemVyXCI7XG5cbmVudW0gVG9rZW5FbnVtIHtcbiAgY2hhcmFjdGVyLFxuICB0YWcsXG4gIGRvY3R5cGUsXG59XG5cbmVudW0gU3RhdGUge1xuICBkYXRhLFxuICB0YWdPcGVuLFxuICBlbmRUYWdPcGVuLFxuICB0YWdOYW1lLFxuICBiZWZvcmVBdHRyaWJ1dGVOYW1lLFxuICBhdHRyaWJ1dGVOYW1lLFxuICBhZnRlckF0dHJpYnV0ZU5hbWUsXG4gIGJlZm9yZUF0dHJpYnV0ZVZhbHVlLFxuICBhdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlZCxcbiAgYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQsXG4gIGF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQsXG4gIGFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQsXG4gIHNlbGZDbG9zaW5nU3RhcnRUYWcsXG4gIGJvZ3VzQ29tbWVudCxcbiAgbWFya3VwRGVjbGFyYXRpb25PcGVuLFxuICBjb21tZW50LFxuICBkb2N0eXBlLFxuICBiZWZvcmVEb2N0eXBlTmFtZSxcbiAgZG9jdHlwZU5hbWUsXG4gIGFmdGVyRG9jdHlwZU5hbWUsXG59XG5cbmludGVyZmFjZSBDaGFyYWN0ZXJUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS5jaGFyYWN0ZXI7XG4gIGNoYXJhY3Rlcjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVGFnVG9rZW4ge1xuICB0eXBlOiBUb2tlbkVudW0udGFnO1xuICBuYW1lOiBzdHJpbmc7XG4gIGNsb3Npbmc6IGJvb2xlYW47XG4gIGF0dHJpYnV0ZXM6IFtzdHJpbmcsIHN0cmluZ11bXTtcbiAgc2VsZkNsb3Npbmc6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBEb2N0eXBlVG9rZW4ge1xuICB0eXBlOiBUb2tlbkVudW0uZG9jdHlwZTtcbiAgZG9jdHlwZTogc3RyaW5nO1xufVxuXG4vLyBnZW5lcmF0aW5nXG5cbmNvbnN0IGdlbmVyYXRlQ2hhcmFjdGVyVG9rZW4gPSAoY2hhcmFjdGVyOiBzdHJpbmcpOiBDaGFyYWN0ZXJUb2tlbiA9PiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogVG9rZW5FbnVtLmNoYXJhY3RlcixcbiAgICBjaGFyYWN0ZXIsXG4gIH07XG59O1xuXG5jb25zdCBnZW5lcmF0ZUVtcHR5VGFnVG9rZW4gPSAoY2xvc2luZzogYm9vbGVhbik6IFRhZ1Rva2VuID0+IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBUb2tlbkVudW0udGFnLFxuICAgIG5hbWU6IFwiXCIsXG4gICAgY2xvc2luZyxcbiAgICBhdHRyaWJ1dGVzOiBbXSxcbiAgICBzZWxmQ2xvc2luZzogZmFsc2UsXG4gIH07XG59O1xuXG5jb25zdCBnZW5lcmF0ZURvY3R5cGVUb2tlbiA9ICgpOiBEb2N0eXBlVG9rZW4gPT4ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFRva2VuRW51bS5kb2N0eXBlLFxuICAgIGRvY3R5cGU6IFwiXCIsXG4gIH07XG59O1xuXG4vLyB0b2tlbml6ZXJpbmdcblxuZnVuY3Rpb24qIHRva2VuaXplcihpbnB1dDogc3RyaW5nKSB7XG4gIGNvbnN0IHMgPSBuZXcgVG9rZW5pemVyQ29udGV4dChpbnB1dCwgMCwgU3RhdGUuZGF0YSk7XG5cbiAgbGV0IHRhZ1Rva2VuOiBUYWdUb2tlbiA9IGdlbmVyYXRlRW1wdHlUYWdUb2tlbihmYWxzZSk7XG4gIGxldCBhdHRyaWJ1dGU6IFtzdHJpbmcsIHN0cmluZ10gPSBbXCJcIiwgXCJcIl07XG4gIGxldCBkb2N0eXBlVG9rZW46IERvY3R5cGVUb2tlbiA9IGdlbmVyYXRlRG9jdHlwZVRva2VuKCk7XG5cbiAgd2hpbGUgKCFzLmVvZigpKSB7XG4gICAgY29uc3Qgc3RhdGUgPSBzLnN0YXRlO1xuICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuZGF0YToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSBcIjxcIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS50YWdPcGVuKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB5aWVsZCBnZW5lcmF0ZUNoYXJhY3RlclRva2VuKGNoYXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUudGFnT3Blbjoge1xuICAgICAgICBjb25zdCBjaGFyID0gcy5jb25zdW1lKCk7XG4gICAgICAgIGlmIChjaGFyID09PSBcIiFcIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUubWFya3VwRGVjbGFyYXRpb25PcGVuKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZW5kVGFnT3Blbik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNDaGFyQWxwaGEoY2hhcikpIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKGZhbHNlKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnRhZ05hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuZW5kVGFnT3Blbjoge1xuICAgICAgICAvLyB3ZSBkb24ndCByZWFsbHkgY2FyZSBhYm91dCBlcnJvciBoYW5kbGluZyB0YmguLi5cbiAgICAgICAgY29uc3QgY2hhciA9IHMuY29uc3VtZSgpO1xuICAgICAgICBpZiAoaXNDaGFyQWxwaGEoY2hhcikpIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKHRydWUpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUudGFnTmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJvZ3VzQ29tbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLnRhZ05hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICB0YWdUb2tlbi5zZWxmQ2xvc2luZyA9IHRydWU7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhZ1Rva2VuLm5hbWUgKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIiB8fCBjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI9XCIpIHtcbiAgICAgICAgICAgIC8vIFRPRE9cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlID0gW1wiXCIsIFwiXCJdO1xuICAgICAgICAgICAgdGFnVG9rZW4uYXR0cmlidXRlcy5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSB8fCBjaGFyID09PSBcIi9cIiB8fCBjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI9XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZVswXSArPSBjaGFyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuc2VsZkNsb3NpbmdTdGFydFRhZyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGUgPSBbXCJcIiwgXCJcIl07XG4gICAgICAgICAgICB0YWdUb2tlbi5hdHRyaWJ1dGVzLnB1c2goYXR0cmlidXRlKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVWYWx1ZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hhciA9IHMuY29uc3VtZSgpO1xuICAgICAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVNpbmdsZVF1b3RlZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVVucXVvdGVkKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZVZhbHVlU2luZ2xlUXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZVsxXSArPSBjaGFyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlVmFsdWVVbnF1b3RlZDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5zZWxmQ2xvc2luZ1N0YXJ0VGFnOiB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgdGFnVG9rZW4uc2VsZkNsb3NpbmcgPSB0cnVlO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYm9ndXNDb21tZW50OiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5tYXJrdXBEZWNsYXJhdGlvbk9wZW46IHtcbiAgICAgICAgY29uc3QgZG9jdHlwZSA9IFwiZG9jdHlwZVwiO1xuICAgICAgICBpZiAocy5wZWVrKGRvY3R5cGUubGVuZ3RoKS50b0xvd2VyQ2FzZSgpID09PSBkb2N0eXBlKSB7XG4gICAgICAgICAgcy5za2lwKGRvY3R5cGUubGVuZ3RoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRvY3R5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHMucGVlaygyKSA9PT0gXCItLVwiKSB7XG4gICAgICAgICAgcy5za2lwKDIpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuY29tbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmNvbW1lbnQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gXCItXCIgJiYgcy5wZWVrKDIpID09PSBcIi0+XCIpIHtcbiAgICAgICAgICAgIHMuc2tpcCgyKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmRvY3R5cGU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgZG9jdHlwZVRva2VuID0gZ2VuZXJhdGVEb2N0eXBlVG9rZW4oKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZG9jdHlwZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5kb2N0eXBlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckRvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIGRvY3R5cGVUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdHlwZVRva2VuLmRvY3R5cGUgKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYWZ0ZXJEb2N0eXBlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIHlpZWxkIGRvY3R5cGVUb2tlbjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgY29uc3QgX3Y6IG5ldmVyID0gc3RhdGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8vIGVuZCBvZiBjb21wbGlhbmNlIHN0YXJ0cyBhcm91bmQgaGVyZS4gSSBqdXN0IHN0YXJ0IHNwaXRiYWxsaW5nIGhlcmUgd3JpdGluZ1xuLy8gaW4gZGlzZ3VzdGluZyBoYWNrc1xuXG5leHBvcnQgY2xhc3MgVGV4dE5vZGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcGFyZW50OiBOb2RlLFxuICAgIHB1YmxpYyB0ZXh0OiBzdHJpbmcsXG4gICkge31cblxuICBnZXQgdGV4dENvbnRleHQoKSB7XG4gICAgcmV0dXJuIHRoaXMudGV4dC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKTtcbiAgfVxuXG4gIGhhc1BhcmVudChub2RlOiBOb2RlKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50Lmhhc1BhcmVudChub2RlKTtcbiAgfVxuXG4gIGRlYnVnKCkge1xuICAgIHJldHVybiB0aGlzLnRleHQ7XG4gIH1cblxuICBodG1sKGluZGVudCA9IDApIHtcbiAgICByZXR1cm4gXCIgXCIucmVwZWF0KGluZGVudCkgKyB0aGlzLnRleHRDb250ZXh0O1xuICB9XG59XG5cbmludGVyZmFjZSBJTm9kZSB7XG4gIHRhZzogc3RyaW5nO1xuICBhdHRyaWJ1dGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBjaGlsZE5vZGVzOiAoVGV4dE5vZGUgfCBJTm9kZSlbXTtcbn1cblxuZXhwb3J0IGNsYXNzIE5vZGUgaW1wbGVtZW50cyBJTm9kZSB7XG4gIGNoaWxkTm9kZXM6IChOb2RlIHwgVGV4dE5vZGUpW10gPSBbXTtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyB0YWc6IHN0cmluZyxcbiAgICBwdWJsaWMgYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9LFxuICAgIHB1YmxpYyBwYXJlbnQ6IE5vZGUgfCB1bmRlZmluZWQsXG4gICkge31cblxuICBoYXNQYXJlbnQobm9kZTogTm9kZSkge1xuICAgIGxldCBjdXJyZW50OiBOb2RlIHwgdW5kZWZpbmVkID0gdGhpcztcbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgaWYgKG5vZGUgPT09IGN1cnJlbnQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgKnZpc2l0KCk6IEdlbmVyYXRvcjxOb2RlIHwgVGV4dE5vZGU+IHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuY2hpbGROb2Rlc1tpXTtcbiAgICAgIHlpZWxkIG5vZGU7XG5cbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICBmb3IgKGNvbnN0IHN1Ym5vZGUgb2Ygbm9kZS52aXNpdCgpKSB7XG4gICAgICAgICAgeWllbGQgc3Vibm9kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gICpnZXRFbGVtZW50c0J5VGFnbmFtZSh0YWduYW1lOiBzdHJpbmcpOiBHZW5lcmF0b3I8Tm9kZT4ge1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiB0aGlzLnZpc2l0KCkpIHtcbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgTm9kZSAmJiBub2RlLnRhZyA9PT0gdGFnbmFtZSkge1xuICAgICAgICB5aWVsZCBub2RlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGRlYnVnKCk6IERlYnVnTm9kZSB7XG4gICAgY29uc3QgeyBwYXJlbnQsIGNoaWxkTm9kZXMsIC4uLnJlc3QgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnJlc3QsXG4gICAgICBjaGlsZE5vZGVzOiBjaGlsZE5vZGVzLm1hcCgoY2hpbGQpID0+IGNoaWxkLmRlYnVnKCkpLFxuICAgIH07XG4gIH1cblxuICBodG1sKGluZGVudCA9IDApOiBzdHJpbmcge1xuICAgIGNvbnN0IG5leHRMZXZlbEluZGVudCA9IHRoaXMudGFnID09PSBcIlwiID8gaW5kZW50IDogaW5kZW50ICsgMjtcbiAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuY2hpbGROb2Rlc1xuICAgICAgLm1hcCgobm9kZSkgPT4gbm9kZS5odG1sKG5leHRMZXZlbEluZGVudCkpXG4gICAgICAuam9pbihcIlxcblwiKTtcbiAgICBpZiAodGhpcy50YWcgPT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgbGV0IGF0dHJpYnV0ZXMgPSBcIlwiO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuYXR0cmlidXRlcykpIHtcbiAgICAgIGF0dHJpYnV0ZXMgKz0gXCIgXCI7XG4gICAgICBhdHRyaWJ1dGVzICs9IGAke2tleX09XCIke3ZhbHVlfVwiYDtcbiAgICB9XG4gICAgY29uc3QgaW5kZW50YXRpb24gPSBcIiBcIi5yZXBlYXQoaW5kZW50KTtcbiAgICByZXR1cm4gYCR7aW5kZW50YXRpb259PCR7dGhpcy50YWd9JHthdHRyaWJ1dGVzfT5cXG4ke2NoaWxkcmVufVxcbiR7aW5kZW50YXRpb259PC8ke3RoaXMudGFnfT5gO1xuICB9XG59XG5cbnR5cGUgUmVtb3ZlTWV0aG9kczxUPiA9IHtcbiAgW1AgaW4ga2V5b2YgVCBhcyBUW1BdIGV4dGVuZHMgRnVuY3Rpb24gPyBuZXZlciA6IFBdOiBUW1BdO1xufTtcblxudHlwZSBEZWJ1Z05vZGUgPSBSZW1vdmVNZXRob2RzPE9taXQ8Tm9kZSwgXCJwYXJlbnRcIiB8IFwiY2hpbGROb2Rlc1wiPj4gJiB7XG4gIGNoaWxkTm9kZXM6IChzdHJpbmcgfCBEZWJ1Z05vZGUpW107XG59O1xuXG5jb25zdCB2b2lkVGFncyA9IFtcbiAgXCJhcmVhXCIsXG4gIFwiYmFzZVwiLFxuICBcImJyXCIsXG4gIFwiY29sXCIsXG4gIFwiZW1iZWRcIixcbiAgXCJoclwiLFxuICBcImltZ1wiLFxuICBcImlucHV0XCIsXG4gIFwibGlua1wiLFxuICBcIm1ldGFcIixcbiAgXCJwYXJhbVwiLFxuICBcInNvdXJjZVwiLFxuICBcInRyYWNrXCIsXG4gIFwid2JyXCIsXG5dO1xuY29uc3QgaW1wbGllZEVuZFRhZ3MgPSBbXG4gIFwiZGRcIixcbiAgXCJkdFwiLFxuICBcImxpXCIsXG4gIFwib3B0Z3JvdXBcIixcbiAgXCJvcHRpb25cIixcbiAgXCJwXCIsXG4gIFwicmJcIixcbiAgXCJycFwiLFxuICBcInJ0XCIsXG4gIFwicnRjXCIsXG5dO1xuXG5jb25zdCBnZW5lcmF0ZUltcGxpZWRFbmRUYWdzID0gWy4uLmltcGxpZWRFbmRUYWdzLCBcImRsXCJdO1xuXG5leHBvcnQgY29uc3QgcGFyc2UgPSAoaW5wdXQ6IHN0cmluZykgPT4ge1xuICBjb25zdCByb290ID0gbmV3IE5vZGUoXCJcIiwge30sIHVuZGVmaW5lZCk7XG4gIGxldCBub2RlID0gcm9vdDtcbiAgY29uc3QgdG9rZW5zID0gWy4uLnRva2VuaXplcihpbnB1dCldO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2ldO1xuICAgIHN3aXRjaCAodG9rZW4udHlwZSkge1xuICAgICAgY2FzZSBUb2tlbkVudW0uZG9jdHlwZToge1xuICAgICAgICAvLyBsb2wgZG9uJ3QgY2FyZSByZW5kZXJpbmcgYXQgaHRtbDUgbm8gbWF0dGVyIHdoYXRcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFRva2VuRW51bS50YWc6IHtcbiAgICAgICAgaWYgKHRva2VuLmNsb3NpbmcpIHtcbiAgICAgICAgICAvLyBsb29rIHVwIGFuZCBzZWUgaWYgdGhlcmUncyBhIG5vZGUgd2UgY2FuIGNsb3NlXG4gICAgICAgICAgbGV0IGN1cnJlbnQgPSBub2RlO1xuICAgICAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgICAgICBpZiAodG9rZW4ubmFtZSA9PT0gY3VycmVudC50YWcpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5hc3NlcnQoY3VycmVudC5wYXJlbnQsIFwiY2xvc2VkIDEgdG9vIG1hbnkgbm9kZXMgbG9sXCIpO1xuICAgICAgICAgICAgICBub2RlID0gY3VycmVudC5wYXJlbnQhO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudCE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChnZW5lcmF0ZUltcGxpZWRFbmRUYWdzLmluY2x1ZGVzKHRva2VuLm5hbWUpKSB7XG4gICAgICAgICAgICAvLyBnb3R0YSBjaGVjayBhbmQgc2VlIGlmIHdlIG5lZWQgdG8gY2xvc2UgYW55dGhpbmcgaW4gdGhlIHRyZWVcbiAgICAgICAgICAgIGxldCBjdXJyZW50ID0gbm9kZTtcbiAgICAgICAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgICAgICAgIGlmIChpbXBsaWVkRW5kVGFncy5pbmNsdWRlcyhjdXJyZW50LnRhZykpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gY3VycmVudC5wYXJlbnQhO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudCE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5ld05vZGUgPSBuZXcgTm9kZShcbiAgICAgICAgICAgIHRva2VuLm5hbWUsXG4gICAgICAgICAgICBPYmplY3QuZnJvbUVudHJpZXModG9rZW4uYXR0cmlidXRlcyksXG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbm9kZS5jaGlsZE5vZGVzLnB1c2gobmV3Tm9kZSk7XG4gICAgICAgICAgaWYgKHZvaWRUYWdzLmluY2x1ZGVzKHRva2VuLm5hbWUpKSB7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUgPSBuZXdOb2RlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgVG9rZW5FbnVtLmNoYXJhY3Rlcjoge1xuICAgICAgICBjb25zdCB0ZXh0bm9kZSA9IG5ldyBUZXh0Tm9kZShub2RlLCBcIlwiKTtcbiAgICAgICAgd2hpbGUgKGkgPCB0b2tlbnMubGVuZ3RoICYmIHRva2Vuc1tpXS50eXBlID09PSBUb2tlbkVudW0uY2hhcmFjdGVyKSB7XG4gICAgICAgICAgdGV4dG5vZGUudGV4dCArPSAodG9rZW5zW2ldIGFzIENoYXJhY3RlclRva2VuKS5jaGFyYWN0ZXI7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUuY2hpbGROb2Rlcy5wdXNoKHRleHRub2RlKTtcbiAgICAgICAgaSAtPSAxO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcm9vdDtcbn07XG4iLAogICAgImltcG9ydCB7IE5vZGUsIFRleHROb2RlIH0gZnJvbSBcIi4vcGFyc2VyXCI7XG5pbXBvcnQgeyBpc0NoYXJTcGFjZSB9IGZyb20gXCIuL3Rva2VuaXplclwiO1xuXG5pbnRlcmZhY2UgU3R5bGUge1xuICBkaXNwbGF5PzogXCJub25lXCIgfCBcImlubGluZVwiIHwgXCJibG9ja1wiO1xuICBjb2xvcj86IHN0cmluZztcbiAgXCJmb250LXNpemVcIj86IG51bWJlcjtcbiAgXCJtYXJnaW4tbGVmdFwiPzogbnVtYmVyO1xuICBcIm1hcmdpbi10b3BcIj86IG51bWJlcjtcbiAgXCJtYXJnaW4tYm90dG9tXCI/OiBudW1iZXI7XG4gIFwiZm9udC13ZWlnaHRcIj86IHN0cmluZztcbiAgXCJ0ZXh0LWRlY29yYXRpb25cIj86IHN0cmluZztcbn1cblxuY29uc3QgRk9OVCA9IFwiVGltZXMgTmV3IFJvbWFuXCI7XG5cbmNvbnN0IGRlZmF1bHRTdHlsZXMgPSB7XG4gIFwiKlwiOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICB9LFxuICB0aXRsZToge1xuICAgIGRpc3BsYXk6IFwibm9uZVwiLFxuICB9LFxuICBoMToge1xuICAgIGRpc3BsYXk6IFwiYmxvY2tcIixcbiAgICBcImZvbnQtc2l6ZVwiOiAzMixcbiAgICBcIm1hcmdpbi10b3BcIjogMjIsXG4gICAgXCJtYXJnaW4tYm90dG9tXCI6IDIyLFxuICAgIFwiZm9udC13ZWlnaHRcIjogXCJib2xkXCIsXG4gIH0sXG4gIGgyOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwiZm9udC1zaXplXCI6IDI0LFxuICAgIFwibWFyZ2luLXRvcFwiOiAyMCxcbiAgICBcIm1hcmdpbi1ib3R0b21cIjogMjAsXG4gICAgXCJmb250LXdlaWdodFwiOiBcImJvbGRcIixcbiAgfSxcbiAgYToge1xuICAgIGRpc3BsYXk6IFwiaW5saW5lXCIsXG4gICAgY29sb3I6IFwiYmx1ZVwiLFxuICAgIFwidGV4dC1kZWNvcmF0aW9uXCI6IFwidW5kZXJsaW5lXCIsXG4gIH0sXG4gIHA6IHtcbiAgICBkaXNwbGF5OiBcImJsb2NrXCIsXG4gICAgXCJtYXJnaW4tdG9wXCI6IDE2LFxuICAgIFwibWFyZ2luLWJvdHRvbVwiOiAxNixcbiAgfSxcbiAgZGw6IHtcbiAgICBkaXNwbGF5OiBcImJsb2NrXCIsXG4gICAgXCJtYXJnaW4tdG9wXCI6IDE2LFxuICAgIFwibWFyZ2luLWJvdHRvbVwiOiAxNixcbiAgfSxcbiAgZHQ6IHsgZGlzcGxheTogXCJibG9ja1wiIH0sXG4gIGRkOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwibWFyZ2luLWxlZnRcIjogNDAsXG4gIH0sXG59IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBTdHlsZT47XG5cbmludGVyZmFjZSBUZXh0Tm9kZVJlbmRlckluZm8ge1xuICAvLyBsZWZ0OiBudW1iZXI7XG4gIC8vIHRvcDogbnVtYmVyO1xuICAvLyByaWdodDogbnVtYmVyO1xuICAvLyBib3R0b206IG51bWJlcjtcbiAgdGV4dDogc3RyaW5nO1xuICBzaXplPzogbnVtYmVyO1xuICBjb2xvcj86IHN0cmluZztcbiAgd2VpZ2h0Pzogc3RyaW5nO1xuICB1bmRlcmxpbmU/OiBib29sZWFuO1xuICBwYXJlbnQ6IE5vZGU7XG59XG5cbmludGVyZmFjZSBUZXh0Tm9kZVJlbmRlckN0eCB7XG4gIHNpemU/OiBudW1iZXI7XG4gIGNvbG9yPzogc3RyaW5nO1xuICB3ZWlnaHQ/OiBzdHJpbmc7XG4gIHVuZGVybGluZT86IGJvb2xlYW47XG59XG5cbi8vIGludGVyZmFjZSBMYXlvdXRDb250ZXh0IHtcbi8vICAgbGVmdDogbnVtYmVyO1xuLy8gICB0b3A6IG51bWJlcjtcbi8vICAgbWFyZ2luTGVmdDogbnVtYmVyO1xuLy8gICBtYXJnaW5Ub3A6IG51bWJlcjtcbi8vICAgY29sb3I/OiBzdHJpbmc7XG4vLyAgIHdlaWdodD86IHN0cmluZztcbi8vICAgdW5kZXJsaW5lPzogYm9vbGVhbjtcbi8vICAgcHJldmlvdXNDaGFyYWN0ZXJXYXNTcGFjZT86IGJvb2xlYW47XG4vLyB9XG4vL1xuLy8gdHlwZSBOb2RlU3RhY2sgPSAoe25vZGUgOiBOb2RlIHwgVGV4dE5vZGUsIGN0eCA6IExheW91dENvbnRleHR9KVtdO1xuXG4vLyBpbnRlcmZhY2UgQmxvY2sge1xuLy8gICBsZWZ0OiBudW1iZXI7XG4vLyAgIHRvcDogbnVtYmVyO1xuLy8gICB3aWR0aDogbnVtYmVyO1xuLy8gICBoZWlnaHQ6IG51bWJlcjtcbi8vICAgbWFyZ2luTGVmdDogbnVtYmVyO1xuLy8gICBtYXJnaW5Ub3A6IG51bWJlcjtcbi8vIH1cblxuaW50ZXJmYWNlIEJsb2NrMiB7XG4gIGJsb2NrOiBOb2RlO1xuICBzdHlsZTogU3R5bGU7XG4gIGVsZW1lbnRzOiBUZXh0Tm9kZVJlbmRlckluZm9bXTtcbn1cblxuY29uc3QgZ2V0U3R5bGVzRm9yVGFnID0gKHRhZzogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBkZWZhdWx0U3R5bGVzW3RhZyBhcyBrZXlvZiB0eXBlb2YgZGVmYXVsdFN0eWxlc10gPz8gZGVmYXVsdFN0eWxlc1tcIipcIl07XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUJsb2Nrcyhib2R5OiBOb2RlKSB7XG4gIGxldCBibG9jazogQmxvY2syID0ge1xuICAgIGJsb2NrOiBib2R5LFxuICAgIHN0eWxlOiBnZXRTdHlsZXNGb3JUYWcoYm9keS50YWcpLFxuICAgIGVsZW1lbnRzOiBbXSxcbiAgfTtcbiAgY29uc3QgYmxvY2tzOiBCbG9jazJbXSA9IFtibG9ja107XG4gIGludGVyZmFjZSBTdGFjayB7XG4gICAgbm9kZTogTm9kZSB8IFRleHROb2RlO1xuICAgIGN0eDogVGV4dE5vZGVSZW5kZXJDdHg7XG4gIH1cbiAgY29uc3Qgc3RhY2s6IFN0YWNrW10gPSBbeyBub2RlOiBib2R5LCBjdHg6IHt9IH1dO1xuXG4gIHdoaWxlIChzdGFjay5sZW5ndGgpIHtcbiAgICBjb25zdCB7IG5vZGUsIGN0eCB9ID0gc3RhY2sucG9wKCkhO1xuXG4gICAgaWYgKCFub2RlLmhhc1BhcmVudChibG9jay5ibG9jaykpIHtcbiAgICAgIGJsb2NrID0ge1xuICAgICAgICBibG9jazogbm9kZS5wYXJlbnQhLFxuICAgICAgICBzdHlsZTogZ2V0U3R5bGVzRm9yVGFnKG5vZGUucGFyZW50IS50YWcpLFxuICAgICAgICBlbGVtZW50czogW10sXG4gICAgICB9O1xuICAgICAgYmxvY2tzLnB1c2goYmxvY2spO1xuICAgIH1cblxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgY29uc3Qgc3R5bGVzID0gZ2V0U3R5bGVzRm9yVGFnKG5vZGUudGFnKTtcblxuICAgICAgaWYgKHN0eWxlcy5kaXNwbGF5ID09PSBcImJsb2NrXCIpIHtcbiAgICAgICAgYmxvY2sgPSB7IGJsb2NrOiBub2RlLCBzdHlsZTogc3R5bGVzLCBlbGVtZW50czogW10gfTtcbiAgICAgICAgYmxvY2tzLnB1c2goYmxvY2spO1xuICAgICAgfSBlbHNlIGlmIChzdHlsZXMuZGlzcGxheSA9PT0gXCJub25lXCIpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5ld0N0eCA9IHtcbiAgICAgICAgLi4uY3R4LFxuICAgICAgfTtcbiAgICAgIGlmIChcImZvbnQtc2l6ZVwiIGluIHN0eWxlcykge1xuICAgICAgICBuZXdDdHguc2l6ZSA9IHN0eWxlc1tcImZvbnQtc2l6ZVwiXTtcbiAgICAgIH1cbiAgICAgIGlmIChcImNvbG9yXCIgaW4gc3R5bGVzKSB7XG4gICAgICAgIG5ld0N0eC5jb2xvciA9IHN0eWxlcy5jb2xvcjtcbiAgICAgIH1cbiAgICAgIGlmIChcInRleHQtZGVjb3JhdGlvblwiIGluIHN0eWxlcykge1xuICAgICAgICBuZXdDdHgudW5kZXJsaW5lID0gc3R5bGVzW1widGV4dC1kZWNvcmF0aW9uXCJdLmluY2x1ZGVzKFwidW5kZXJsaW5lXCIpO1xuICAgICAgfVxuICAgICAgaWYgKFwiZm9udC13ZWlnaHRcIiBpbiBzdHlsZXMpIHtcbiAgICAgICAgbmV3Q3R4LndlaWdodCA9IHN0eWxlc1tcImZvbnQtd2VpZ2h0XCJdO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gbm9kZS5jaGlsZE5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIHN0YWNrLnB1c2goeyBub2RlOiBub2RlLmNoaWxkTm9kZXNbaV0sIGN0eDogbmV3Q3R4IH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBibG9jay5lbGVtZW50cy5wdXNoKHtcbiAgICAgICAgcGFyZW50OiBub2RlLnBhcmVudCxcbiAgICAgICAgdGV4dDogbm9kZS50ZXh0Q29udGV4dCxcbiAgICAgICAgLi4uY3R4LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gd2UnbGwgbm9ybWFsaXplIGhlcmUgYXMgd2VsbC4gZ290dGEgZ2V0IHJpZCBvZiBhbnkgZW1wdHkgb3JcbiAgLy8gbGVhZGluZy90cmFpbGluZyB3aGl0ZXNwYWNlXG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBibG9jayA9IGJsb2Nrc1tpXTtcbiAgICBsZXQgc2hvdWxkUmVtb3ZlTGVhZGluZyA9IHRydWU7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBibG9jay5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGJsb2NrLmVsZW1lbnRzW2ldO1xuICAgICAgaWYgKHNob3VsZFJlbW92ZUxlYWRpbmcpIHtcbiAgICAgICAgZWxlbWVudC50ZXh0ID0gZWxlbWVudC50ZXh0LnJlcGxhY2UoL15cXHMrLywgXCJcIik7XG4gICAgICB9XG4gICAgICBpZiAoZWxlbWVudC50ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgfSBlbHNlIGlmIChpc0NoYXJTcGFjZShlbGVtZW50LnRleHRbZWxlbWVudC50ZXh0Lmxlbmd0aCAtIDFdKSkge1xuICAgICAgICBzaG91bGRSZW1vdmVMZWFkaW5nID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNob3VsZFJlbW92ZUxlYWRpbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gYmxvY2suZWxlbWVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBibG9jay5lbGVtZW50c1tpXTtcbiAgICAgIGVsZW1lbnQudGV4dCA9IGVsZW1lbnQudGV4dC5yZXBsYWNlKC9cXHMrJC8sIFwiXCIpO1xuICAgICAgaWYgKGVsZW1lbnQudGV4dC5sZW5ndGgpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gbm93IHJlbW92ZSBhbGwgZW1wdHkgYmxvY2tzXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYmxvY2sgPSBibG9ja3NbaV07XG4gICAgYmxvY2suZWxlbWVudHMgPSBibG9jay5lbGVtZW50cy5maWx0ZXIoKGVsZW1lbnQpID0+IGVsZW1lbnQudGV4dCk7XG4gICAgaWYgKGJsb2NrLmVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgYmxvY2tzLnNwbGljZShpLCAxKTtcbiAgICAgIGktLTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmxvY2tzO1xufVxuXG5jb25zdCBkcmF3VGV4dCA9IChcbiAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG4gIGVsZW1lbnRzOiBUZXh0Tm9kZVJlbmRlckluZm9bXSxcbiAgd2lkdGg6IG51bWJlcixcbiAgYmxvY2tMZWZ0OiBudW1iZXIsXG4gIGJsb2NrVG9wOiBudW1iZXIsXG4pID0+IHtcbiAgY29uc3QgcmF0aW8gPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgY3R4LnRleHRCYXNlbGluZSA9IFwiYWxwaGFiZXRpY1wiO1xuICBjdHgudGV4dEFsaWduID0gXCJsZWZ0XCI7XG4gIGxldCBsZWZ0ID0gYmxvY2tMZWZ0O1xuICBsZXQgdG9wID0gYmxvY2tUb3A7XG4gIGxldCBtYXhIZWlnaHQgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IGVsZW1lbnRzW2ldO1xuICAgIGNvbnN0IHNpemUgPSAoZWxlbWVudC5zaXplID8/IDE2KSAqIHJhdGlvO1xuICAgIGN0eC5mb250ID0gYCR7ZWxlbWVudC53ZWlnaHQgPz8gXCJub3JtYWxcIn0gJHtzaXplfXB4ICR7Rk9OVH1gO1xuICAgIGN0eC5maWxsU3R5bGUgPSBlbGVtZW50LmNvbG9yID8/IFwiYmxhY2tcIjtcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSBlbGVtZW50LmNvbG9yID8/IFwiYmxhY2tcIjtcbiAgICBtYXhIZWlnaHQgPSBNYXRoLm1heChtYXhIZWlnaHQsIHNpemUpO1xuXG4gICAgbGV0IHRleHRMZWZ0VG9Xcml0ZSA9IGVsZW1lbnQudGV4dDtcbiAgICB3aGlsZSAodGV4dExlZnRUb1dyaXRlKSB7XG4gICAgICAvLyBqdXN0IHdyaXRlIG9uZSB3b3JkIGF0IGEgdGltZVxuICAgICAgY29uc3QgaW5kZXggPSB0ZXh0TGVmdFRvV3JpdGUuaW5kZXhPZihcIiBcIik7XG4gICAgICBsZXQgdGV4dCA9IFwiXCI7XG4gICAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICAgIHRleHQgPSB0ZXh0TGVmdFRvV3JpdGU7XG4gICAgICAgIHRleHRMZWZ0VG9Xcml0ZSA9IFwiXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZXh0ID0gdGV4dExlZnRUb1dyaXRlLnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICAgIHRleHRMZWZ0VG9Xcml0ZSA9IHRleHRMZWZ0VG9Xcml0ZS5zbGljZShpbmRleCArIDEpO1xuICAgICAgfVxuICAgICAgY29uc3QgbWVhc3VyZWQgPSBjdHgubWVhc3VyZVRleHQodGV4dCk7XG4gICAgICBpZiAobWVhc3VyZWQud2lkdGggKyBsZWZ0ID4gd2lkdGgpIHtcbiAgICAgICAgdG9wICs9IHNpemU7XG4gICAgICAgIGxlZnQgPSBibG9ja0xlZnQ7XG4gICAgICB9XG4gICAgICBjdHguZmlsbFRleHQodGV4dCwgbGVmdCwgdG9wICsgc2l6ZSAqIDAuNzUpO1xuICAgICAgaWYgKGVsZW1lbnQudW5kZXJsaW5lKSB7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4Lm1vdmVUbyhsZWZ0LCB0b3AgKyBzaXplICogMC45KTtcbiAgICAgICAgY3R4LmxpbmVUbyhsZWZ0ICsgbWVhc3VyZWQud2lkdGgsIHRvcCArIHNpemUgKiAwLjkpO1xuICAgICAgICBjdHgubGluZVdpZHRoID0gcmF0aW87XG4gICAgICAgIGN0eC5zdHJva2UoKTtcbiAgICAgIH1cbiAgICAgIGxlZnQgKz0gbWVhc3VyZWQud2lkdGg7XG4gICAgfVxuICB9XG4gIHJldHVybiB0b3AgKyBtYXhIZWlnaHQ7XG59O1xuXG5leHBvcnQgY29uc3QgcmVuZGVyID0gKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQsIGJvZHk6IE5vZGUpID0+IHtcbiAgY29uc3QgcmF0aW8gPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSE7XG4gIGNvbnN0IGJsb2NrcyA9IGdlbmVyYXRlQmxvY2tzKGJvZHkpO1xuICBjb25zdCB3aWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgY29uc3QgZ2xvYmFsTWFyZ2luID0gODtcbiAgbGV0IHByZXZpb3VzTWFyZ2luQm90dG9tID0gODtcbiAgbGV0IHkgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGJsb2NrID0gYmxvY2tzW2ldO1xuICAgIGNvbnN0IHtcbiAgICAgIFwibWFyZ2luLXRvcFwiOiBtYXJnaW5Ub3AsXG4gICAgICBcIm1hcmdpbi1ib3R0b21cIjogbWFyZ2luQm90dG9tLFxuICAgICAgXCJtYXJnaW4tbGVmdFwiOiBtYXJnaW5MZWZ0LFxuICAgIH0gPSBibG9jay5zdHlsZTtcbiAgICBjb25zdCBhY3R1YWxNYXJnaW5Ub3AgPSBNYXRoLm1heChtYXJnaW5Ub3AgPz8gMCwgcHJldmlvdXNNYXJnaW5Cb3R0b20pICogcmF0aW87XG4gICAgeSArPSBhY3R1YWxNYXJnaW5Ub3A7XG4gICAgY29uc3QgYWN0dWFsTWFyZ2luTGVmdCA9IChnbG9iYWxNYXJnaW4gKyAobWFyZ2luTGVmdCA/PyAwKSkgKiByYXRpbztcblxuICAgIHkgPSBkcmF3VGV4dChjdHgsIGJsb2NrLmVsZW1lbnRzLCB3aWR0aCwgYWN0dWFsTWFyZ2luTGVmdCwgeSk7XG4gICAgcHJldmlvdXNNYXJnaW5Cb3R0b20gPSBtYXJnaW5Cb3R0b20gPz8gMDtcbiAgfVxufTtcbiIsCiAgICAiaW1wb3J0IHsgTm9kZSwgcGFyc2UgfSBmcm9tIFwiLi9wYXJzZXJcIjtcbmltcG9ydCB7IHJlbmRlciB9IGZyb20gXCIuL3JlbmRlcmVyXCI7XG5cbmNvbnN0IFBST1hZX0hPU1QgPSB3aW5kb3cubG9jYXRpb24uaHJlZi5pbmNsdWRlcyhcImxvY2FsaG9zdFwiKVxuICA/IFwiaHR0cDovL2xvY2FsaG9zdDo4MDkwXCJcbiAgOiBcImh0dHBzOi8vYnJvd3Nlci5tYmt2LmlvL3Byb3h5XCI7XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoUGFnZSh1cmw6IHN0cmluZykge1xuICAvLyBnb3R0YSBwcm94eSBkdWUgdG8gY29ycyBlcnJvcnNcbiAgY29uc3QgcHJveGllZCA9IGAke1BST1hZX0hPU1R9LyR7dXJsfWA7XG4gIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChwcm94aWVkKTtcbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3AudGV4dCgpO1xuXG4gIHJldHVybiB0ZXh0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKCkge1xuICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNhbnZhc1wiKSBhcyBIVE1MQ2FudmFzRWxlbWVudDtcbiAgY29uc3QgaHRtbERpc3BsYXkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcbiAgICBcImlucHV0aHRtbFwiLFxuICApIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG4gIGNvbnN0IGFkZHJlc3NCYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcbiAgICBcImFkZHJlc3MtYmFyXCIsXG4gICkhIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gIGxldCB0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGxldCBodG1sOiBOb2RlIHwgdW5kZWZpbmVkO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHJlc2l6ZSgpIHtcbiAgICBpZiAoY2FudmFzLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IHJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gICAgICBjb25zdCB3aWR0aCA9IGNhbnZhcy5wYXJlbnRFbGVtZW50LmNsaWVudFdpZHRoO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gY2FudmFzLnBhcmVudEVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuICAgICAgY2FudmFzLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuICAgICAgY2FudmFzLnN0eWxlLmhlaWdodCA9IGAke2hlaWdodH1weGA7XG4gICAgICBjYW52YXMud2lkdGggPSBjYW52YXMucGFyZW50RWxlbWVudC5jbGllbnRXaWR0aCAqIHJhdGlvO1xuICAgICAgY2FudmFzLmhlaWdodCA9IGNhbnZhcy5wYXJlbnRFbGVtZW50LmNsaWVudEhlaWdodCAqIHJhdGlvO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHJ1bigpIHtcbiAgICB0ZXh0ID0gYXdhaXQgZmV0Y2hQYWdlKGFkZHJlc3NCYXIudmFsdWUpO1xuICAgIGh0bWwgPSBwYXJzZSh0ZXh0KTtcbiAgICBodG1sRGlzcGxheS50ZXh0Q29udGVudCA9IGh0bWwuaHRtbCgpO1xuXG4gICAgcmVzaXplKCk7XG4gICAgcmVuZGVyKGNhbnZhcywgaHRtbCk7XG4gIH1cblxuICBhZGRyZXNzQmFyLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIHJ1bik7XG4gIHJ1bigpO1xufVxuXG5pZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgbWFpbik7XG59IGVsc2Uge1xuICBtYWluKCk7XG59XG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBQU8s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ZUFDM0IsV0FDRjtBQUNBLFFBQU0sYUFBYSxTQUFTLGVBQzFCLGFBQ0Y7QUFDQSxNQUFJO0FBQ0osTUFBSTtBQUVKLGlCQUFlLE1BQU0sR0FBRztBQUN0QixRQUFJLE9BQU8sZUFBZTtBQUN4QixZQUFNLFFBQVEsT0FBTztBQUNyQixZQUFNLFFBQVEsT0FBTyxjQUFjO0FBQ25DLFlBQU0sU0FBUyxPQUFPLGNBQWM7QUFDcEMsYUFBTyxNQUFNLFFBQVEsR0FBRztBQUN4QixhQUFPLE1BQU0sU0FBUyxHQUFHO0FBQ3pCLGFBQU8sUUFBUSxPQUFPLGNBQWMsY0FBYztBQUNsRCxhQUFPLFNBQVMsT0FBTyxjQUFjLGVBQWU7QUFBQSxJQUN0RDtBQUFBO0FBR0YsaUJBQWUsR0FBRyxHQUFHO0FBQ25CLFdBQU8sTUFBTSxVQUFVLFdBQVcsS0FBSztBQUN2QyxXQUFPLE1BQU0sSUFBSTtBQUNqQixnQkFBWSxjQUFjLEtBQUssS0FBSztBQUVwQyxXQUFPO0FBQ1AsV0FBTyxRQUFRLElBQUk7QUFBQTtBQUdyQixhQUFXLGlCQUFpQixRQUFRLEdBQUc7QUFDdkMsTUFBSTtBQUFBO0FBOUNOLElBQU0sYUFBYSxPQUFPLFNBQVMsS0FBSyxTQUFTLFdBQVcsSUFDeEQsMEJBQ0E7QUErQ0osSUFBSSxTQUFTLGVBQWUsV0FBVztBQUNyQyxXQUFTLGlCQUFpQixvQkFBb0IsSUFBSTtBQUNwRCxPQUFPO0FBQ0wsT0FBSztBQUFBOyIsCiAgImRlYnVnSWQiOiAiREVGNDg1OUYyREMyRjBFMTY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
