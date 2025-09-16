import { Calculator } from './calculator';

describe('Calculator', () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  describe('add', () => {
    it('should add two positive numbers correctly', () => {
      expect(calculator.add(2, 3)).toBe(5);
    });

    it('should add a positive and a negative number correctly', () => {
      expect(calculator.add(5, -3)).toBe(2);
    });

    it('should add two negative numbers correctly', () => {
      expect(calculator.add(-5, -3)).toBe(-8);
    });

    it('should add zero correctly', () => {
      expect(calculator.add(5, 0)).toBe(5);
    });
  });

  describe('subtract', () => {
    it('should subtract two positive numbers correctly', () => {
      expect(calculator.subtract(5, 3)).toBe(2);
    });

    it('should subtract a positive and a negative number correctly', () => {
      expect(calculator.subtract(5, -3)).toBe(8);
    });

    it('should subtract two negative numbers correctly', () => {
      expect(calculator.subtract(-5, -3)).toBe(-2);
    });

    it('should subtract zero correctly', () => {
      expect(calculator.subtract(5, 0)).toBe(5);
    });
  });

  describe('multiply', () => {
    it('should multiply two positive numbers correctly', () => {
      expect(calculator.multiply(2, 3)).toBe(6);
    });

    it('should multiply a positive and a negative number correctly', () => {
      expect(calculator.multiply(5, -3)).toBe(-15);
    });

    it('should multiply two negative numbers correctly', () => {
      expect(calculator.multiply(-5, -3)).toBe(15);
    });

    it('should multiply by zero correctly', () => {
      expect(calculator.multiply(5, 0)).toBe(0);
    });
  });

  describe('divide', () => {
    it('should divide two positive numbers correctly', () => {
      expect(calculator.divide(6, 3)).toBe(2);
    });

    it('should divide a positive and a negative number correctly', () => {
      expect(calculator.divide(15, -3)).toBe(-5);
    });

    it('should divide two negative numbers correctly', () => {
      expect(calculator.divide(-15, -3)).toBe(5);
    });

    it('should return Infinity when dividing by zero', () => {
      expect(calculator.divide(5, 0)).toBe(Infinity);
    });

    it('should return 0 when dividing zero by a number', () => {
      expect(calculator.divide(0, 5)).toBe(0);
    });

    it('should handle decimal results correctly', () => {
      expect(calculator.divide(5, 2)).toBe(2.5);
    });
  });

  describe('power', () => {
    it('should calculate positive exponent correctly', () => {
      expect(calculator.power(2, 3)).toBe(8);
    });

    it('should calculate negative exponent correctly', () => {
      expect(calculator.power(2, -2)).toBe(0.25);
    });

    it('should handle zero exponent correctly', () => {
      expect(calculator.power(5, 0)).toBe(1);
    });

    it('should handle base of zero correctly', () => {
      expect(calculator.power(0, 5)).toBe(0);
    });

    it('should handle fractional exponent correctly', () => {
      expect(calculator.power(4, 0.5)).toBe(2);
    });
  });

  describe('sqrt', () => {
    it('should calculate square root of positive number correctly', () => {
      expect(calculator.sqrt(9)).toBe(3);
    });

    it('should calculate square root of zero correctly', () => {
      expect(calculator.sqrt(0)).toBe(0);
    });

    it('should return NaN for negative numbers', () => {
      expect(calculator.sqrt(-9)).toBeNaN();
    });

    it('should handle decimal results correctly', () => {
      expect(calculator.sqrt(2)).toBeCloseTo(1.4142, 4);
    });
  });
});