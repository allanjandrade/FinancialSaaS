import assert from 'node:assert/strict'

const salary = 3000
const bankExpense = 530
const internalTransfer = 4200
const benefitCredit = 682
const benefitPurchase = 400
const openCardBill = 480
const investment = 1000

const bankBeforeTransfer = 6670
const santanderAfterTransfer = bankBeforeTransfer - internalTransfer
const nubankAfterTransfer = internalTransfer
const totalBankAfterTransfer = santanderAfterTransfer + nubankAfterTransfer
const benefitBalance = benefitCredit - benefitPurchase
const realResult = salary - bankExpense - openCardBill
const netWorth = totalBankAfterTransfer + investment - openCardBill

assert.equal(totalBankAfterTransfer, bankBeforeTransfer, 'Internal transfer changed total bank balance')
assert.equal(benefitBalance, 282, 'VA balance must be credits minus debits')
assert.equal(realResult, 1990, 'Monthly result must exclude VA and internal transfers')
assert.equal(netWorth, 7190, 'Net worth formula is inconsistent')

console.log(JSON.stringify({
  status: 'PASS',
  realIncome: salary,
  realBankExpense: bankExpense,
  internalTransfer: 'excluded',
  benefitBalance,
  benefitInNetWorth: 0,
  openCardBill: -openCardBill,
  investment,
  netWorth,
}, null, 2))
