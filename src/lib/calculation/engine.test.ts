import { describe, it, expect } from "vitest";
import { evaluate, CalculationError } from "./engine";

describe("Calculation Engine", () => {
  describe("basic arithmetic", () => {
    it("evaluates addition", () => {
      expect(evaluate("2 + 3").result).toBe(5);
    });

    it("evaluates subtraction", () => {
      expect(evaluate("10 - 4").result).toBe(6);
    });

    it("evaluates multiplication", () => {
      expect(evaluate("3 * 7").result).toBe(21);
    });

    it("evaluates division", () => {
      expect(evaluate("20 / 4").result).toBe(5);
    });

    it("evaluates exponentiation", () => {
      expect(evaluate("2 ^ 10").result).toBe(1024);
    });

    it("evaluates a single number", () => {
      expect(evaluate("42").result).toBe(42);
    });

    it("evaluates decimal numbers", () => {
      expect(evaluate("3.14 + 1.86").result).toBe(5);
    });
  });

  describe("operator precedence", () => {
    it("multiplication before addition", () => {
      expect(evaluate("2 + 3 * 4").result).toBe(14);
    });

    it("division before subtraction", () => {
      expect(evaluate("10 - 6 / 2").result).toBe(7);
    });

    it("exponentiation before multiplication", () => {
      expect(evaluate("2 * 3 ^ 2").result).toBe(18);
    });

    it("complex mixed operations", () => {
      expect(evaluate("1 + 2 * 3 ^ 2 - 4 / 2").result).toBe(17);
    });

    it("right-associative exponentiation", () => {
      // 2^3^2 = 2^(3^2) = 2^9 = 512
      expect(evaluate("2 ^ 3 ^ 2").result).toBe(512);
    });
  });

  describe("parentheses", () => {
    it("overrides precedence with parentheses", () => {
      expect(evaluate("(2 + 3) * 4").result).toBe(20);
    });

    it("nested parentheses", () => {
      expect(evaluate("((2 + 3) * (4 - 1))").result).toBe(15);
    });

    it("deeply nested parentheses", () => {
      expect(evaluate("(((1 + 2)))").result).toBe(3);
    });

    it("complex expression with parentheses", () => {
      expect(evaluate("(2 + 3) * (4 + 5) / (1 + 2)").result).toBe(15);
    });
  });

  describe("unary operators", () => {
    it("unary minus", () => {
      expect(evaluate("-5").result).toBe(-5);
    });

    it("unary minus in expression", () => {
      expect(evaluate("3 + -2").result).toBe(1);
    });

    it("double unary minus", () => {
      expect(evaluate("--5").result).toBe(5);
    });

    it("unary plus", () => {
      expect(evaluate("+5").result).toBe(5);
    });
  });

  describe("error handling", () => {
    it("throws on division by zero", () => {
      expect(() => evaluate("1 / 0")).toThrow(CalculationError);
      expect(() => evaluate("1 / 0")).toThrow("Division by zero");
    });

    it("throws on empty expression", () => {
      expect(() => evaluate("")).toThrow(CalculationError);
      expect(() => evaluate("")).toThrow("Empty expression");
    });

    it("throws on invalid characters", () => {
      expect(() => evaluate("2 & 3")).toThrow(CalculationError);
      expect(() => evaluate("2 & 3")).toThrow("Unexpected character");
    });

    it("throws on mismatched parentheses", () => {
      expect(() => evaluate("(2 + 3")).toThrow(CalculationError);
    });

    it("throws on extra closing parenthesis", () => {
      expect(() => evaluate("2 + 3)")).toThrow(CalculationError);
    });

    it("throws on incomplete expression", () => {
      expect(() => evaluate("2 +")).toThrow(CalculationError);
    });

    it("throws on consecutive operators", () => {
      expect(() => evaluate("2 * * 3")).toThrow(CalculationError);
    });
  });

  describe("return value structure", () => {
    it("returns expression and result", () => {
      const res = evaluate("  2 + 3  ");
      expect(res.expression).toBe("2 + 3");
      expect(res.result).toBe(5);
    });
  });
});
