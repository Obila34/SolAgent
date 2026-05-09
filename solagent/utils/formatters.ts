export function formatSol(amount: number): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function shortHash(value: string, chars = 4): string {
  if (value.length <= chars * 2) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}
