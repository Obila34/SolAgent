import { PublicKey } from "@solana/web3.js";

export function isValidSolanaAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
