export const isCharSpace = (string: string) => {
  return string === " " || string == "\n" || string === "\t" || string === "\f";
};

export const isCharDigit = (string: string) => {
  const charCode = string.charCodeAt(0);
  const zero = "0".charCodeAt(0);
  const nine = "9".charCodeAt(0);

  return charCode >= zero && charCode <= nine;
};

export const isCharAlpha = (string: string) => {
  const charCode = string.charCodeAt(0);
  const a = "a".charCodeAt(0);
  const z = "z".charCodeAt(0);
  const A = "A".charCodeAt(0);
  const Z = "Z".charCodeAt(0);

  return (charCode >= a && charCode <= z) || (charCode >= A && charCode <= Z);
};

export const isCharHex = (string: string) => {
  const charCode = string.charCodeAt(0);
  const a = "a".charCodeAt(0);
  const f = "f".charCodeAt(0);
  const A = "A".charCodeAt(0);
  const F = "F".charCodeAt(0);

  return (
    isCharDigit(string) ||
    (charCode >= a && charCode <= f) ||
    (charCode >= A && charCode <= F)
  );
};

export const isCharBase64 = (string: string) => {
  return (
    isCharAlpha(string) ||
    isCharDigit(string) ||
    string[0] === "_" ||
    string[0] === "-"
  );
};

export class TokenizerContext<State> {
  returnState: State[] = [];

  constructor(
    public input: string,
    public index: number,
    public state: State,
  ) {}

  getRest() {
    return this.input.slice(this.index);
  }

  peek(length: number) {
    return this.input.slice(this.index, this.index + length);
  }

  startsWith(string: string) {
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

  setState(state: State, returnState?: State) {
    if (returnState != null) {
      this.returnState.push(returnState);
    }
    this.state = state;
  }

  popReturnState() {
    this.state = this.returnState.pop()!;
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

  set(ctx: TokenizerContext<State>) {
    this.returnState = ctx.returnState;
    this.input = ctx.input;
    this.index = ctx.index;
    this.state = ctx.state;
  }
}
