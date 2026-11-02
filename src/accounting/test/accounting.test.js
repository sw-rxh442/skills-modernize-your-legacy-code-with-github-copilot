'use strict';

// Unit tests mirroring the scenarios in docs/TESTPLAN.md.
// Cases marked "known defect" assert the replicated COBOL behavior, which the
// stakeholders have not yet approved as correct (see the plan's Fail cases).

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  createDataStore,
  formatBalance,
  parseAmount,
  parseMenuChoice,
  viewBalance,
  creditAccount,
  debitAccount,
} = require('../index');

const APP = path.join(__dirname, '..', 'index.js');
const INVALID = 'Invalid choice, please select 1-4.';

// Runs the real program with the given input lines, as a user would type them.
function runApp(lines) {
  const result = spawnSync(process.execPath, [APP], {
    input: lines.map((line) => `${line}\n`).join(''),
    encoding: 'utf8',
    timeout: 5000,
  });
  return { ...result, output: result.stdout };
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

describe('formatBalance', () => {
  test('pads whole and fraction parts to the COBOL picture 9(6)V99', () => {
    expect(formatBalance(100000)).toBe('001000.00'); // TC-010 initial balance
    expect(formatBalance(0)).toBe('000000.00'); // TC-022 zero balance
    expect(formatBalance(99)).toBe('000000.99'); // TC-014 cents
    expect(formatBalance(99999999)).toBe('999999.99'); // maximum value
  });
});

describe('parseMenuChoice', () => {
  test('accepts a single digit 1-4 (TC-021, TC-010, TC-012, TC-016, TC-022, TC-028)', () => {
    expect(parseMenuChoice('1')).toBe(1);
    expect(parseMenuChoice('2')).toBe(2);
    expect(parseMenuChoice('3')).toBe(3);
    expect(parseMenuChoice('4')).toBe(4);
  });

  test('returns 0 for digit 0 and out-of-range digits (TC-003, TC-004)', () => {
    expect(parseMenuChoice('0')).toBe(0);
    expect(parseMenuChoice('5')).toBe(5); // parsed as 5, then rejected by main
  });

  test('returns 0 for non-numeric or blank input (TC-005, TC-006)', () => {
    expect(parseMenuChoice('abc')).toBe(0);
    expect(parseMenuChoice('')).toBe(0);
    expect(parseMenuChoice(null)).toBe(0);
  });

  test('known defect: reads only the first character (TC-007, TC-008)', () => {
    expect(parseMenuChoice('12')).toBe(1);
    expect(parseMenuChoice('23')).toBe(2);
  });
});

describe('parseAmount', () => {
  test('converts whole and decimal amounts to cents (TC-012, TC-014, TC-021, TC-023)', () => {
    expect(parseAmount('500')).toBe(50000);
    expect(parseAmount('0.99')).toBe(99);
    expect(parseAmount('300')).toBe(30000);
    expect(parseAmount('1000.01')).toBe(100001);
  });

  test('zero amounts are allowed (TC-013, TC-025)', () => {
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('0.01')).toBe(1);
  });

  test('truncates, not rounds, to two decimals (TC-015)', () => {
    expect(parseAmount('12.345')).toBe(1234);
  });

  test('known defect: a minus sign is dropped (TC-016, TC-026)', () => {
    expect(parseAmount('-50')).toBe(5000);
    expect(parseAmount('-300')).toBe(30000);
  });

  test('known defect: whole digits beyond six are dropped (TC-018)', () => {
    expect(parseAmount('1000000')).toBe(0);
  });

  test('known defect: non-numeric and blank input is taken as zero (TC-019, TC-020, TC-027)', () => {
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('xyz')).toBe(0);
    expect(parseAmount('')).toBe(0);
  });

  test('known defect: input is cut to the 8-character field width (TC-017)', () => {
    // '999998.99' is cut to '999998.9', so the last digit is lost: 999998.90
    expect(parseAmount('999998.99')).toBe(99999890);
    expect(parseAmount('999999')).toBe(99999900);
  });
});

describe('createDataStore', () => {
  test('returns the initial value and keeps the last value written', () => {
    const store = createDataStore(100000);
    expect(store.read()).toBe(100000);
    store.write(150000);
    expect(store.read()).toBe(150000);
  });
});

describe('viewBalance', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('displays the balance without changing it (TC-010, TC-011)', () => {
    const store = createDataStore(100000);
    viewBalance(store);
    viewBalance(store);
    expect(logSpy).toHaveBeenNthCalledWith(1, 'Current balance: 001000.00');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'Current balance: 001000.00');
    expect(store.read()).toBe(100000);
  });
});

describe('creditAccount', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('adds a whole-number amount (TC-012)', async () => {
    const store = createDataStore(100000);
    const accept = jest.fn().mockResolvedValue('500');
    await creditAccount(store, accept);
    expect(accept).toHaveBeenCalledWith('Enter credit amount: ');
    expect(store.read()).toBe(150000);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 001500.00');
  });

  test('a zero credit leaves the balance unchanged (TC-013)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => '0');
    expect(store.read()).toBe(100000);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 001000.00');
  });

  test('adds an amount with cents (TC-014)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => '0.99');
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 001000.99');
  });

  test('truncates an amount with more than two decimals (TC-015)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => '12.345');
    expect(store.read()).toBe(101234);
  });

  test('known defect: a negative credit is posted as positive (TC-016)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => '-50');
    expect(store.read()).toBe(105000);
  });

  test('known defect: overflow past the maximum wraps silently (TC-017)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => '999999');
    expect(store.read()).toBe(99900);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 000999.00');
  });

  test('known defect: an amount over six whole digits is reported as credited with no change (TC-018)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => '1000000');
    expect(store.read()).toBe(100000);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 001000.00');
  });

  test('known defect: a non-numeric amount is reported as credited with no change (TC-019, TC-020)', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => 'abc');
    expect(store.read()).toBe(100000);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 001000.00');
  });

  test('end of input leaves the balance unchanged and prints nothing', async () => {
    const store = createDataStore(100000);
    await creditAccount(store, async () => null);
    expect(store.read()).toBe(100000);
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('debitAccount', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('subtracts an amount the balance covers (TC-021)', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => '300');
    expect(store.read()).toBe(70000);
    expect(logSpy).toHaveBeenCalledWith('Amount debited. New balance: 000700.00');
  });

  test('allows debiting the exact balance (TC-022)', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => '1000');
    expect(store.read()).toBe(0);
    expect(logSpy).toHaveBeenCalledWith('Amount debited. New balance: 000000.00');
  });

  test('refuses a debit above the balance (TC-023)', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => '1000.01');
    expect(store.read()).toBe(100000);
    expect(logSpy).toHaveBeenCalledWith('Insufficient funds for this debit.');
  });

  test('refuses any debit when the balance is zero (TC-024)', async () => {
    const store = createDataStore(0);
    await debitAccount(store, async () => '0.01');
    expect(store.read()).toBe(0);
    expect(logSpy).toHaveBeenCalledWith('Insufficient funds for this debit.');
  });

  test('a zero debit leaves the balance unchanged (TC-025)', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => '0');
    expect(store.read()).toBe(100000);
    expect(logSpy).toHaveBeenCalledWith('Amount debited. New balance: 001000.00');
  });

  test('known defect: a negative debit is posted as positive (TC-026)', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => '-300');
    expect(store.read()).toBe(70000);
  });

  test('known defect: a non-numeric debit is reported as debited with no change (TC-027)', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => 'xyz');
    expect(store.read()).toBe(100000);
    expect(logSpy).toHaveBeenCalledWith('Amount debited. New balance: 001000.00');
  });

  test('end of input leaves the balance unchanged and prints nothing', async () => {
    const store = createDataStore(100000);
    await debitAccount(store, async () => null);
    expect(store.read()).toBe(100000);
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('application flow (menu, via the real program)', () => {
  test('TC-001: shows the menu and prompt on start-up', () => {
    const { output } = runApp(['4']);
    expect(output).toContain('Account Management System');
    expect(output).toContain('1. View Balance');
    expect(output).toContain('2. Credit Account');
    expect(output).toContain('3. Debit Account');
    expect(output).toContain('4. Exit');
    expect(output).toContain('Enter your choice (1-4): ');
  });

  test('TC-002 and TC-030: option 4 exits with goodbye and status 0', () => {
    const result = runApp(['4']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('Exiting the program. Goodbye!');
  });

  test('TC-003: choice 0 is rejected and the menu repeats', () => {
    const { output, status } = runApp(['0', '4']);
    expect(output).toContain(INVALID);
    expect(countOccurrences(output, 'Account Management System')).toBe(2);
    expect(status).toBe(0);
  });

  test('TC-004: choice 5 is rejected', () => {
    const { output } = runApp(['5', '4']);
    expect(output).toContain(INVALID);
  });

  test('TC-005: non-numeric choice is rejected', () => {
    const { output } = runApp(['abc', '4']);
    expect(output).toContain(INVALID);
  });

  test('TC-006: blank choice is rejected', () => {
    const { output } = runApp(['', '4']);
    expect(output).toContain(INVALID);
  });

  test('known defect TC-007: "12" is read as choice 1 and shows the balance', () => {
    const { output } = runApp(['12', '4']);
    expect(output).toContain('Current balance: 001000.00');
    expect(output).not.toContain(INVALID);
  });

  test('known defect TC-008: "23" is read as credit, and "100" is credited', () => {
    const { output } = runApp(['23', '100', '3', '4']);
    expect(output).toContain('Enter credit amount: ');
    expect(output).toContain('Amount credited. New balance: 001100.00');
  });

  test('TC-009: end of input exits instead of looping forever', () => {
    const result = runApp([]);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.output).toContain('Goodbye');
    expect(countOccurrences(result.output, INVALID)).toBe(0);
  });

  test('TC-010: viewing the initial balance shows 001000.00', () => {
    const { output } = runApp(['1', '4']);
    expect(output).toContain('Current balance: 001000.00');
  });

  test('TC-011: viewing twice does not change the balance', () => {
    const { output } = runApp(['1', '1', '4']);
    expect(countOccurrences(output, 'Current balance: 001000.00')).toBe(2);
  });

  test('TC-012: credit 500 then view shows 001500.00', () => {
    const { output } = runApp(['2', '500', '1', '4']);
    expect(output).toContain('Enter credit amount: ');
    expect(output).toContain('Amount credited. New balance: 001500.00');
    expect(output).toContain('Current balance: 001500.00');
  });

  test('TC-013: zero credit leaves the balance at 001000.00', () => {
    const { output } = runApp(['2', '0', '4']);
    expect(output).toContain('Amount credited. New balance: 001000.00');
  });

  test('TC-021: debit 300 then view shows 000700.00', () => {
    const { output } = runApp(['3', '300', '1', '4']);
    expect(output).toContain('Amount debited. New balance: 000700.00');
    expect(output).toContain('Current balance: 000700.00');
  });

  test('TC-022: debit the exact balance shows 000000.00', () => {
    const { output } = runApp(['3', '1000', '1', '4']);
    expect(output).toContain('Amount debited. New balance: 000000.00');
    expect(output).toContain('Current balance: 000000.00');
  });

  test('TC-023: debit above the balance is refused', () => {
    const { output } = runApp(['3', '1000.01', '1', '4']);
    expect(output).toContain('Insufficient funds for this debit.');
    expect(output).toContain('Current balance: 001000.00');
  });

  test('TC-024: after the balance is zero, any debit is refused', () => {
    const { output } = runApp(['3', '1000', '3', '0.01', '1', '4']);
    expect(output).toContain('Insufficient funds for this debit.');
    expect(output).toContain('Current balance: 000000.00');
  });

  test('TC-028: credit then debit in one session share the same balance', () => {
    const { output } = runApp(['2', '100', '3', '250', '1', '4']);
    expect(output).toContain('Amount credited. New balance: 001100.00');
    expect(output).toContain('Amount debited. New balance: 000850.00');
    expect(output).toContain('Current balance: 000850.00');
  });

  test('TC-029: each new start begins at 1000.00 (no persistence)', () => {
    runApp(['2', '500', '4']);
    const { output } = runApp(['1', '4']);
    expect(output).toContain('Current balance: 001000.00');
  });
});
