# Test Plan: Account Management System (COBOL)

This test plan documents the current business logic and behavior of the COBOL
Account Management System (`src/cobol/main.cob`, `src/cobol/operations.cob`,
`src/cobol/data.cob`). It is intended to be validated with business stakeholders
and later used as the basis for unit and integration tests in the Node.js version.

## Business rules covered

- The account starts with a balance of **1000.00** each time the program starts. The balance is held in memory only and is **not** persisted between runs.
- The user can view the balance, credit the account, debit the account, or exit, using menu options 1 to 4.
- A **credit** adds the entered amount to the balance.
- A **debit** subtracts the entered amount only if the balance covers it (balance >= amount). Otherwise the debit is refused and the balance is unchanged.
- Amounts are held as `9(6)V99`: up to 999999.99, two decimal places, unsigned.

## Stakeholder decisions needed

Several cases show behavior that may be a defect or may need a business decision. These are marked **Fail** where the current behavior does not match the rule the business would expect, and the comments explain why:

1. Non-numeric, blank, negative, and oversized amounts are accepted silently (see TC-016 to TC-020, TC-026, TC-027).
2. Amounts with more than two decimals are truncated, not rounded (TC-015). Confirm the intended rule.
3. Zero-value credits and debits are allowed (TC-013, TC-025). Confirm whether they should be rejected.
4. Balances are not persisted between runs (TC-029). Confirm this is intended for the current scope.
5. Multi-digit menu input is read by its first digit only (TC-007, TC-008).
6. End of input on the menu causes an endless loop (TC-009).

## Test cases

Test steps list input in the order it is typed. "Enter" means a line of input is submitted. Unless stated otherwise, pre-conditions assume a fresh start of the program with a balance of 1000.00.

| Test Case ID | Test Case Description | Pre-conditions | Test Steps | Expected Result | Actual Result | Status (Pass/Fail) | Comments |
|---|---|---|---|---|---|---|---|
| TC-001 | Main menu is displayed on start-up | Program compiled and started | 1. Start the program; 2. Observe the screen | The menu header, options 1 to 4, and the prompt "Enter your choice (1-4):" are shown | Menu displayed exactly as expected | Pass | |
| TC-002 | Exit with option 4 ends the program | Program started | 1. Enter `4` | "Exiting the program. Goodbye!" is shown and the program ends with exit code 0 | As expected | Pass | |
| TC-003 | Choice `0` is rejected | Program started | 1. Enter `0`; 2. Enter `4` | "Invalid choice, please select 1-4." is shown, the menu is shown again, and the program continues until exit | As expected | Pass | |
| TC-004 | Choice `5` is rejected | Program started | 1. Enter `5`; 2. Enter `4` | "Invalid choice, please select 1-4." is shown and the menu is shown again | As expected | Pass | |
| TC-005 | Non-numeric menu choice is rejected | Program started | 1. Enter `abc`; 2. Enter `4` | "Invalid choice, please select 1-4." is shown and the menu is shown again | As expected | Pass | |
| TC-006 | Blank menu choice is rejected | Program started | 1. Enter a blank line; 2. Enter `4` | "Invalid choice, please select 1-4." is shown and the menu is shown again | As expected | Pass | |
| TC-007 | Multi-digit menu choice outside 1-4 is rejected | Program started | 1. Enter `12`; 2. Enter `4` | "Invalid choice, please select 1-4." is shown, because `12` is not a valid option | Input `12` was read as `1` and the balance was displayed | Fail | Defect. The menu field is a single digit (`PIC 9`), so only the first character is used. Expected behavior is rejection. Decision needed (see stakeholder decision 5). |
| TC-008 | Multi-digit menu choice starting with 2 or 3 is rejected | Program started | 1. Enter `23`; 2. Enter `100`; 3. Enter `4` | "Invalid choice, please select 1-4." is shown and no credit or debit occurs | Input `23` was read as `2`, the credit prompt was shown, and `100` was credited (balance 1100.00) | Fail | Defect, same root cause as TC-007. A typo such as `23` can silently post a transaction. |
| TC-009 | End of input at the menu ends the program | Program started; stdin is closed (for example, the input stream ends) | 1. Close stdin or send end-of-file at the menu prompt | The program exits without a loop | The menu and "Invalid choice, please select 1-4." repeat endlessly until the process is killed | Fail | Defect. `ACCEPT USER-CHOICE` leaves the field unchanged at end of input, so the loop never ends. Test was stopped with a timeout. A fix is to handle the end-of-input exception and exit the loop. |
| TC-010 | View the initial balance | Program started; no transactions | 1. Enter `1`; 2. Enter `4` | "Current balance: 001000.00" is shown | As expected | Pass | |
| TC-011 | Viewing the balance does not change it | Program started | 1. Enter `1`; 2. Enter `1`; 3. Enter `4` | Both views show 001000.00 and the balance is unchanged | Both views showed 001000.00 | Pass | |
| TC-012 | Credit a whole-number amount | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `500`; 3. Enter `1`; 4. Enter `4` | "Enter credit amount:" is shown, then "Amount credited. New balance: 001500.00". Viewing shows 001500.00 | As expected | Pass | |
| TC-013 | Credit a zero amount | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `0`; 3. Enter `4` | Balance stays at 001000.00 and the credit message is shown | Balance 001000.00 and credit message shown | Pass | Behavior allowed by the current code. Decision needed on whether zero credits should be rejected (stakeholder decision 3). |
| TC-014 | Credit an amount with cents | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `0.99`; 3. Enter `4` | "Amount credited. New balance: 001000.99" | As expected | Pass | |
| TC-015 | Credit an amount with more than two decimal places | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `12.345`; 3. Enter `4` | Expected per current rule: amount is truncated to 12.34, so the balance is 001012.34. Rounding (1012.35) may be the business intent. | Balance 001012.34 (truncated) | Pass | Passes against the current truncation behavior. Stakeholders must confirm truncation rather than rounding (stakeholder decision 2). |
| TC-016 | Negative credit amount is rejected | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `-50`; 3. Enter `4` | Credit is refused with an error message and the balance stays at 001000.00 | The minus sign is dropped. 50.00 was credited and the balance is 001050.00 | Fail | Defect. The amount field is unsigned, so a negative credit is silently posted as a positive one. |
| TC-017 | Credit that would exceed the maximum balance is rejected | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `999999`; 3. Enter `4` | Credit is refused (the resulting balance of 1000999.00 exceeds 999999.99) and the balance stays at 001000.00 | Balance shows 000999.00. The high-order digit was dropped silently | Fail | Defect. The `ADD` has no size-error check, so overflow wraps silently. Amounts typed with more than 8 characters also appear to be cut short: `999998.99` was posted as 998.90 and `999999.99` as 999999.90 (likely the input is truncated to the field width before the decimal point is counted; to be confirmed). |
| TC-018 | Credit amount with more than six whole digits is rejected | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `1000000`; 3. Enter `4` | Credit is refused with an error message and the balance stays at 001000.00 | "Amount credited" is shown and the balance stays at 001000.00 (the amount was taken as 0) | Fail | Defect. The high-order digits are dropped and the transaction is reported as successful. |
| TC-019 | Non-numeric credit amount is rejected | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `abc`; 3. Enter `4` | Credit is refused with an error message and the balance stays at 001000.00 | "Amount credited" is shown and the balance stays at 001000.00 (the amount was taken as 0) | Fail | Defect. Non-numeric input is accepted as zero and reported as a successful credit. |
| TC-020 | Blank credit amount is rejected | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter a blank line; 3. Enter `4` | Credit is refused with an error message and the balance stays at 001000.00 | "Amount credited" is shown and the balance stays at 001000.00 | Fail | Defect. Same root cause as TC-019. |
| TC-021 | Debit an amount that the balance covers | Program started; balance 1000.00 | 1. Enter `3`; 2. Enter `300`; 3. Enter `1`; 4. Enter `4` | "Amount debited. New balance: 000700.00". Viewing shows 000700.00 | As expected | Pass | |
| TC-022 | Debit the exact balance | Program started; balance 1000.00 | 1. Enter `3`; 2. Enter `1000`; 3. Enter `1`; 4. Enter `4` | "Amount debited. New balance: 000000.00". Viewing shows 000000.00 | As expected | Pass | Allowed by the rule balance >= amount. Stakeholders to confirm a zero balance is acceptable. |
| TC-023 | Debit more than the balance is refused | Program started; balance 1000.00 | 1. Enter `3`; 2. Enter `1000.01`; 3. Enter `1`; 4. Enter `4` | "Insufficient funds for this debit." is shown and the balance stays at 001000.00 | As expected | Pass | |
| TC-024 | Any debit is refused when the balance is zero | Balance is 0.00 (TC-022 run first in the same session) | 1. Enter `3`; 2. Enter `0.01`; 3. Enter `1`; 4. Enter `4` | "Insufficient funds for this debit." is shown and the balance stays at 000000.00 | "Insufficient funds for this debit." shown and balance 000000.00 | Pass | Run in the same session as TC-022 (1000 debited, then 0.01 requested). Covered as a sequence test. |
| TC-025 | Debit a zero amount | Program started; balance 1000.00 | 1. Enter `3`; 2. Enter `0`; 3. Enter `1`; 4. Enter `4` | Balance stays at 001000.00 and the debit message is shown | Debit message shown and balance 001000.00 | Pass | Behavior allowed by the current code. Decision needed on whether zero debits should be rejected (stakeholder decision 3). |
| TC-026 | Negative debit amount is rejected | Program started; balance 1000.00 | 1. Enter `3`; 2. Enter `-300`; 3. Enter `4` | Debit is refused with an error message and the balance stays at 001000.00 | The minus sign is dropped. 300.00 was debited and the balance is 000700.00 | Fail | Defect. Same root cause as TC-016. A negative debit is silently treated as a positive one. |
| TC-027 | Non-numeric debit amount is rejected | Program started; balance 1000.00 | 1. Enter `3`; 2. Enter `xyz`; 3. Enter `1`; 4. Enter `4` | Debit is refused with an error message and the balance stays at 001000.00 | "Amount debited. New balance: 001000.00" is shown (the amount was taken as 0) | Fail | Defect. Same root cause as TC-019. |
| TC-028 | Credit and debit in one session update the same balance | Program started; balance 1000.00 | 1. Enter `2`; 2. Enter `100`; 3. Enter `3`; 4. Enter `250`; 5. Enter `1`; 6. Enter `4` | After credit: 001100.00. After debit: 000850.00. Viewing shows 000850.00 | As expected | Pass | Confirms the credit and debit operations share the same balance. |
| TC-029 | Balance resets to 1000.00 on a new start | Previous session credited 500 (balance 1500.00) and then exited | 1. Start the program; 2. Enter `1`; 3. Enter `4` | Balance is 001000.00 (balances are not saved) | Balance 001000.00 | Pass | Current behavior is session-only storage. Stakeholders to confirm whether persistence is required (stakeholder decision 4). |
| TC-030 | Exit ends the program without changing the balance | Program started; balance 1000.00 | 1. Enter `1`; 2. Enter `4` | "Exiting the program. Goodbye!" is shown and the program ends with exit code 0 | As expected | Pass | |
