import { isCharAlpha, isCharSpace, TokenizerContext } from "./tokenizer";

enum TokenEnum {
  character,
  tag,
  doctype,
}

enum State {
  data,
  tagOpen,
  endTagOpen,
  tagName,
  beforeAttributeName,
  attributeName,
  afterAttributeName,
  beforeAttributeValue,
  attributeValueDoubleQuoted,
  attributeValueSingleQuoted,
  attributeValueUnquoted,
  afterAttributeValueQuoted,
  selfClosingStartTag,
  bogusComment,
  markupDeclarationOpen,
  comment,
  doctype,
  beforeDoctypeName,
  doctypeName,
  afterDoctypeName,
}

interface CharacterToken {
  type: TokenEnum.character;
  character: string;
}

interface TagToken {
  type: TokenEnum.tag;
  name: string;
  closing: boolean;
  attributes: [string, string][];
  selfClosing: boolean;
}

interface DoctypeToken {
  type: TokenEnum.doctype;
  doctype: string;
}

// generating

const generateCharacterToken = (character: string): CharacterToken => {
  return {
    type: TokenEnum.character,
    character,
  };
};

const generateEmptyTagToken = (closing: boolean): TagToken => {
  return {
    type: TokenEnum.tag,
    name: "",
    closing,
    attributes: [],
    selfClosing: false,
  };
};

const generateDoctypeToken = (): DoctypeToken => {
  return {
    type: TokenEnum.doctype,
    doctype: "",
  };
};

// tokenizering

function* tokenizer(input: string) {
  const s = new TokenizerContext(input, 0, State.data);

  let tagToken: TagToken = generateEmptyTagToken(false);
  let attribute: [string, string] = ["", ""];
  let doctypeToken: DoctypeToken = generateDoctypeToken();

  while (!s.eof()) {
    const state = s.state;
    switch (state) {
      case State.data: {
        for (const char of s) {
          if (char === "<") {
            s.setState(State.tagOpen);
            break;
          } else {
            yield generateCharacterToken(char);
          }
        }
        break;
      }
      case State.tagOpen: {
        const char = s.consume();
        if (char === "!") {
          s.setState(State.markupDeclarationOpen);
        } else if (char === "/") {
          s.setState(State.endTagOpen);
        } else if (isCharAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(false);
          s.setState(State.tagName);
        } else {
          s.reconsume();
          s.setState(State.data);
        }
        break;
      }
      case State.endTagOpen: {
        // we don't really care about error handling tbh...
        const char = s.consume();
        if (isCharAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(true);
          s.setState(State.tagName);
        } else {
          s.reconsume();
          s.setState(State.bogusComment);
        }
        break;
      }
      case State.tagName: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(State.beforeAttributeName);
            break;
          } else if (char === "/") {
            tagToken.selfClosing = true;
            s.setState(State.selfClosingStartTag);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            tagToken.name += char.toLowerCase();
          }
        }
        break;
      }
      case State.beforeAttributeName: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else if (char === "/" || char === ">") {
            s.reconsume();
            s.setState(State.afterAttributeName);
            break;
          } else if (char === "=") {
            // TODO
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(State.attributeName);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case State.attributeName: {
        for (const char of s) {
          if (isCharSpace(char) || char === "/" || char === ">") {
            s.reconsume();
            s.setState(State.afterAttributeName);
            break;
          } else if (char === "=") {
            s.setState(State.beforeAttributeValue);
            break;
          } else {
            attribute[0] += char.toLowerCase();
          }
        }
        break;
      }
      case State.afterAttributeName: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else if (char === "/") {
            s.setState(State.selfClosingStartTag);
            break;
          } else if (char === "=") {
            s.setState(State.beforeAttributeValue);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(State.attributeName);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case State.beforeAttributeValue: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          }
          s.reconsume();
          break;
        }
        const char = s.consume();
        if (char === '"') {
          s.setState(State.attributeValueDoubleQuoted);
        } else if (char === "'") {
          s.setState(State.attributeValueSingleQuoted);
        } else if (char === ">") {
          yield tagToken;
          s.setState(State.data);
        } else {
          s.reconsume();
          s.setState(State.attributeValueUnquoted);
        }
        break;
      }
      case State.attributeValueDoubleQuoted: {
        for (const char of s) {
          if (char === '"') {
            s.setState(State.afterAttributeValueQuoted);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case State.attributeValueSingleQuoted: {
        for (const char of s) {
          if (char === "'") {
            s.setState(State.afterAttributeValueQuoted);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case State.attributeValueUnquoted: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(State.beforeAttributeName);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case State.afterAttributeValueQuoted: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(State.beforeAttributeName);
            break;
          } else if (char === "/") {
            s.setState(State.selfClosingStartTag);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            s.reconsume();
            s.setState(State.beforeAttributeName);
            break;
          }
        }
        break;
      }
      case State.selfClosingStartTag: {
        const char = s.consume();
        if (char === ">") {
          tagToken.selfClosing = true;
          s.setState(State.data);
        } else {
          s.reconsume();
          s.setState(State.beforeDoctypeName);
        }
        break;
      }
      case State.bogusComment: {
        for (const char of s) {
          if (char === ">") {
            s.setState(State.data);
            break;
          }
        }
        break;
      }
      case State.markupDeclarationOpen: {
        const doctype = "doctype";
        if (s.peek(doctype.length).toLowerCase() === doctype) {
          s.skip(doctype.length);
          s.setState(State.doctype);
        } else if (s.peek(2) === "--") {
          s.skip(2);
          s.setState(State.comment);
        }
        break;
      }
      case State.comment: {
        for (const char of s) {
          if (char === "-" && s.peek(2) === "->") {
            s.skip(2);
            s.setState(State.data);
            break;
          }
        }
        break;
      }
      case State.doctype: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(State.beforeDoctypeName);
            break;
          } else {
            s.reconsume();
            s.setState(State.beforeDoctypeName);
            break;
          }
        }
        break;
      }
      case State.beforeDoctypeName: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else {
            s.reconsume();
            doctypeToken = generateDoctypeToken();
            s.setState(State.doctypeName);
            break;
          }
        }
        break;
      }
      case State.doctypeName: {
        for (const char of s) {
          if (isCharSpace(char)) {
            s.setState(State.afterDoctypeName);
            break;
          } else if (char === ">") {
            yield doctypeToken;
            s.setState(State.data);
            break;
          } else {
            doctypeToken.doctype += char.toLowerCase();
          }
        }
        break;
      }
      case State.afterDoctypeName: {
        for (const char of s) {
          if (isCharSpace(char)) {
            continue;
          } else if (char === ">") {
            s.setState(State.data);
            yield doctypeToken;
            break;
          }
        }
        break;
      }
      default: {
        const _v: never = state;
      }
    }
  }
}

// end of compliance starts around here. I just start spitballing here writing
// in disgusting hacks

export class TextNode {
  constructor(
    public parent: Node,
    public text: string,
  ) {}

  get textContext() {
    return this.text.replace(/\s+/g, " ");
  }

  hasParent(node: Node) {
    return this.parent.hasParent(node);
  }

  debug() {
    return this.text;
  }

  html(indent = 0) {
    return " ".repeat(indent) + this.textContext;
  }
}

interface INode {
  tag: string;
  attributes: Record<string, string>;
  childNodes: (TextNode | INode)[];
}

export class Node implements INode {
  childNodes: (Node | TextNode)[] = [];
  public constructor(
    public tag: string,
    public attributes: Record<string, string> = {},
    public parent: Node | undefined,
  ) {}

  hasParent(node: Node) {
    let current: Node | undefined = this;
    while (current) {
      if (node === current) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  *visit(): Generator<Node | TextNode> {
    for (let i = 0; i < this.childNodes.length; i++) {
      const node = this.childNodes[i];
      yield node;

      if (node instanceof Node) {
        for (const subnode of node.visit()) {
          yield subnode;
        }
      }
    }
  }

  *getElementsByTagname(tagname: string): Generator<Node> {
    for (const node of this.visit()) {
      if (node instanceof Node && node.tag === tagname) {
        yield node;
      }
    }
  }

  debug(): DebugNode {
    const { parent, childNodes, ...rest } = this;
    return {
      ...rest,
      childNodes: childNodes.map((child) => child.debug()),
    };
  }

  html(indent = 0): string {
    const nextLevelIndent = this.tag === "" ? indent : indent + 2;
    const children = this.childNodes
      .map((node) => node.html(nextLevelIndent))
      .join("\n");
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

type RemoveMethods<T> = {
  [P in keyof T as T[P] extends Function ? never : P]: T[P];
};

type DebugNode = RemoveMethods<Omit<Node, "parent" | "childNodes">> & {
  childNodes: (string | DebugNode)[];
};

const voidTags = [
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
  "wbr",
];
const impliedEndTags = [
  "dd",
  "dt",
  "li",
  "optgroup",
  "option",
  "p",
  "rb",
  "rp",
  "rt",
  "rtc",
];

const generateImpliedEndTags = [...impliedEndTags, "dl"];

export const parse = (input: string) => {
  const root = new Node("", {}, undefined);
  let node = root;
  const tokens = [...tokenizer(input)];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case TokenEnum.doctype: {
        // lol don't care rendering at html5 no matter what
        break;
      }
      case TokenEnum.tag: {
        if (token.closing) {
          // look up and see if there's a node we can close
          let current = node;
          while (current) {
            if (token.name === current.tag) {
              console.assert(current.parent, "closed 1 too many nodes lol");
              node = current.parent!;
              break;
            }
            current = current.parent!;
          }
        } else {
          if (generateImpliedEndTags.includes(token.name)) {
            // gotta check and see if we need to close anything in the tree
            let current = node;
            while (current) {
              if (impliedEndTags.includes(current.tag)) {
                node = current.parent!;
                break;
              }
              current = current.parent!;
            }
          }
          const newNode = new Node(
            token.name,
            Object.fromEntries(token.attributes),
            node,
          );
          node.childNodes.push(newNode);
          if (voidTags.includes(token.name)) {
          } else {
            node = newNode;
          }
        }
        break;
      }
      case TokenEnum.character: {
        const textnode = new TextNode(node, "");
        while (i < tokens.length && tokens[i].type === TokenEnum.character) {
          textnode.text += (tokens[i] as CharacterToken).character;
          i += 1;
        }
        node.childNodes.push(textnode);
        i -= 1;
      }
    }
  }
  return root;
};
