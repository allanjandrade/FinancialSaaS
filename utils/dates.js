const monthNames = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function monthKeyFromDate(dateString, shift = 0) {
  const [year, month] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1 + shift, 1);
  return date.getFullYear() * 100 + (date.getMonth() + 1);
}

export function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(year, month - 1, day));
}

export function formatImpact(key) {
  const year = Math.floor(key / 100);
  const month = key % 100;
  return `${monthNames[month - 1]}/${year}`;
}

export { monthNames };
