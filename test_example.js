// Basic test example
function sum(a, b) {
    return a + b;
}

describe('Math operations', () => {
    test('adds 1 + 2 to equal 3', () => {
        expect(sum(1, 2)).toBe(3);
    });
});