// Calculation Engine - Expression Parser & Evaluator
// Uses recursive descent parsing for correct operator precedence:
// Level 1 (lowest):  + -
// Level 2:           * /
// Level 3 (highest): ^
// Parentheses override precedence

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculationError";
  }
}

// --- Tokenizer ---

enum TokenType {
  Number,
  Plus,
  Minus,
  Star,
  Slash,
  Caret,
  LeftParen,
  RightParen,
  End,
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    if (ch >= "0" && ch <= "9" || ch === ".") {
      const start = i;
      let hasDecimal = ch === ".";
      i++;
      while (i < expression.length) {
        const c = expression[i];
        if (c >= "0" && c <= "9") {
          i++;
        } else if (c === "." && !hasDecimal) {
          hasDecimal = true;
          i++;
        } else {
          break;
        }
      }
      const numStr = expression.slice(start, i);
      if (numStr === ".") {
        throw new CalculationError(`Invalid number at position ${start}`);
      }
      tokens.push({ type: TokenType.Number, value: numStr, position: start });
      continue;
    }

    const single: Record<string, TokenType> = {
      "+": TokenType.Plus,
      "-": TokenType.Minus,
      "*": TokenType.Star,
      "/": TokenType.Slash,
      "^": TokenType.Caret,
      "(": TokenType.LeftParen,
      ")": TokenType.RightParen,
    };

    if (ch in single) {
      tokens.push({ type: single[ch], value: ch, position: i });
      i++;
      continue;
    }

    throw new CalculationError(
      `Unexpected character '${ch}' at position ${i}`
    );
  }

  tokens.push({ type: TokenType.End, value: "", position: i });
  return tokens;
}

// --- Parser & Evaluator ---

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private consume(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new CalculationError(
        `Expected ${TokenType[type]} but got '${token.value}' at position ${token.position}`
      );
    }
    this.pos++;
    return token;
  }

  parse(): number {
    const result = this.parseAddition();
    if (this.current().type !== TokenType.End) {
      const token = this.current();
      throw new CalculationError(
        `Unexpected token '${token.value}' at position ${token.position}`
      );
    }
    return result;
  }

  // Addition and subtraction (lowest precedence)
  private parseAddition(): number {
    let left = this.parseMultiplication();
    while (
      this.current().type === TokenType.Plus ||
      this.current().type === TokenType.Minus
    ) {
      const op = this.current();
      this.pos++;
      const right = this.parseMultiplication();
      if (op.type === TokenType.Plus) {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    return left;
  }

  // Multiplication and division
  private parseMultiplication(): number {
    let left = this.parseExponent();
    while (
      this.current().type === TokenType.Star ||
      this.current().type === TokenType.Slash
    ) {
      const op = this.current();
      this.pos++;
      const right = this.parseExponent();
      if (op.type === TokenType.Star) {
        left = left * right;
      } else {
        if (right === 0) {
          throw new CalculationError("Division by zero");
        }
        left = left / right;
      }
    }
    return left;
  }

  // Exponentiation (right-associative, highest binary precedence)
  private parseExponent(): number {
    const base = this.parseUnary();
    if (this.current().type === TokenType.Caret) {
      this.pos++;
      const exp = this.parseExponent(); // right-associative via recursion
      return Math.pow(base, exp);
    }
    return base;
  }

  // Unary plus/minus
  private parseUnary(): number {
    if (this.current().type === TokenType.Minus) {
      this.pos++;
      return -this.parseUnary();
    }
    if (this.current().type === TokenType.Plus) {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  // Numbers and parenthesized expressions
  private parsePrimary(): number {
    const token = this.current();

    if (token.type === TokenType.Number) {
      this.pos++;
      return parseFloat(token.value);
    }

    if (token.type === TokenType.LeftParen) {
      this.pos++;
      const result = this.parseAddition();
      this.consume(TokenType.RightParen);
      return result;
    }

    if (token.type === TokenType.End) {
      throw new CalculationError("Unexpected end of expression");
    }

    throw new CalculationError(
      `Unexpected token '${token.value}' at position ${token.position}`
    );
  }
}

// --- Public API ---

export interface CalculationResult {
  expression: string;
  result: number;
}

export function evaluate(expression: string): CalculationResult {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new CalculationError("Empty expression");
  }

  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const result = parser.parse();

  if (!isFinite(result)) {
    throw new CalculationError("Result is not a finite number");
  }

  return { expression: trimmed, result };
}
