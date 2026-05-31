export function createIncome(data) {
  const { date, type, description, amount } = data;
  return {
    id: crypto.randomUUID(),
    date,
    type,
    description,
    amount,
    account: "Conta principal",
    recurring: false,
  };
}
