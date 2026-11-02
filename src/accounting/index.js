#!/usr/bin/env node
'use strict';

// Node.js port of the COBOL Account Management System (MainProgram, Operations, DataProgram).

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000; // 1000.00
const BALANCE_MODULUS_CENTS = 100000000; // PIC 9(6)V99 keeps six integer digits
const AMOUNT_FIELD_WIDTH = 8; // PIC 9(6)V99 accepts 8 characters, including the decimal point

const MENU_LINES = [
  '--------------------------------',
  'Account Management System',
  '1. View Balance',
  '2. Credit Account',
  '3. Debit Account',
  '4. Exit',
  '--------------------------------',
];

// Mirrors DataProgram: READ returns the stored balance and WRITE replaces it.
function createDataStore(initialCents) {
  let balanceCents = initialCents;
  return {
    read: () => balanceCents,
    write: (cents) => {
      balanceCents = cents;
    },
  };
}

function formatBalance(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${String(whole).padStart(6, '0')}.${String(fraction).padStart(2, '0')}`;
}

// Matches the COBOL ACCEPT into PIC 9: only the first character is used.
function parseMenuChoice(raw) {
  const first = (raw ?? '').charAt(0);
  return /^[0-9]$/.test(first) ? Number(first) : 0;
}

// Matches the COBOL ACCEPT into PIC 9(6)V99. Returns the amount in cents.
function parseAmount(raw) {
  const field = (raw ?? '').slice(0, AMOUNT_FIELD_WIDTH);
  if (!/^[0-9 +\-,.]*$/.test(field)) {
    return 0;
  }
  const digits = field.replace(/[ +\-,]/g, '');
  const parts = digits.split('.');
  if (parts.length > 2) {
    return 0;
  }
  const [integerPart = '', fractionPart = ''] = parts;
  const whole = Number(integerPart.slice(-6) || '0');
  const cents = Number((fractionPart + '00').slice(0, 2));
  return whole * 100 + cents;
}

function viewBalance(store) {
  console.log(`Current balance: ${formatBalance(store.read())}`);
}

async function creditAccount(store, accept) {
  const raw = await accept('Enter credit amount: ');
  if (raw === null) {
    return;
  }
  const amount = parseAmount(raw);
  // COBOL ADD without SIZE ERROR: high-order digits are lost when the sum overflows.
  const newBalance = (store.read() + amount) % BALANCE_MODULUS_CENTS;
  store.write(newBalance);
  console.log(`Amount credited. New balance: ${formatBalance(newBalance)}`);
}

async function debitAccount(store, accept) {
  const raw = await accept('Enter debit amount: ');
  if (raw === null) {
    return;
  }
  const amount = parseAmount(raw);
  const balance = store.read();
  if (balance >= amount) {
    const newBalance = balance - amount;
    store.write(newBalance);
    console.log(`Amount debited. New balance: ${formatBalance(newBalance)}`);
  } else {
    console.log('Insufficient funds for this debit.');
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines = rl[Symbol.asyncIterator]();
  const accept = async (prompt) => {
    console.log(prompt);
    const { value, done } = await lines.next();
    return done ? null : value;
  };

  const store = createDataStore(INITIAL_BALANCE_CENTS);
  let continueFlag = true;

  while (continueFlag) {
    MENU_LINES.forEach((line) => console.log(line));
    const raw = await accept('Enter your choice (1-4): ');
    if (raw === null) {
      // End of input: stop instead of re-prompting forever.
      break;
    }

    switch (parseMenuChoice(raw)) {
      case 1:
        viewBalance(store);
        break;
      case 2:
        await creditAccount(store, accept);
        break;
      case 3:
        await debitAccount(store, accept);
        break;
      case 4:
        continueFlag = false;
        break;
      default:
        console.log('Invalid choice, please select 1-4.');
    }
  }

  console.log('Exiting the program. Goodbye!');
  rl.close();
}

if (require.main === module) {
  main();
}

module.exports = {
  createDataStore,
  formatBalance,
  parseAmount,
  parseMenuChoice,
  viewBalance,
  creditAccount,
  debitAccount,
  main,
};
