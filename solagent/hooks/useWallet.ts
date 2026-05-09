import AsyncStorage from "@react-native-async-storage/async-storage";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { useState } from "react";
import { getWalletBalances } from "../services/solana";
import { useWalletStore } from "../store/walletStore";
import { isValidSolanaAddress } from "../utils/addressUtils";

const AUTH_TOKEN_KEY = "solagent:mwa:auth_token";
const HELIUS_RPC_URL =
  process.env.EXPO_PUBLIC_HELIUS_RPC_URL ??
  `https://rpc.helius.xyz/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? ""}`;
const connection = new Connection(HELIUS_RPC_URL, "confirmed");

const isMWASupported = Platform.OS === "android";

function getMwaModule(): typeof import("@solana-mobile/mobile-wallet-adapter-protocol") {
  if (!isMWASupported) {
    throw new Error("MWA is only available on Android.");
  }
  // Loaded only on Android so iOS/Expo Go never initializes the native MWA module at load time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@solana-mobile/mobile-wallet-adapter-protocol") as typeof import("@solana-mobile/mobile-wallet-adapter-protocol");
}

export class WalletNotConnectedError extends Error {
  constructor() {
    super("Wallet is not connected.");
    this.name = "WalletNotConnectedError";
  }
}

export class UserRejectedError extends Error {
  constructor() {
    super("The wallet request was rejected by the user.");
    this.name = "UserRejectedError";
  }
}

export class TxFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxFailedError";
  }
}

function decodeAddressBase64ToBase58(addressBase64: string): string {
  const bytes = Buffer.from(addressBase64, "base64");
  return new PublicKey(bytes).toBase58();
}

async function confirmSignature(signature: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const status = await connection.getSignatureStatuses([signature]);
    const value = status.value[0];
    if (value?.err) throw new TxFailedError("The transaction didn't go through. Want me to try again?");
    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new TxFailedError("Transaction confirmation timed out after 30 seconds.");
}

export function useWallet() {
  const wallet = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectWithAddress(address: string): Promise<void> {
    if (!isValidSolanaAddress(address)) {
      setError("That address doesn't look right. Can you double-check it?");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      wallet.setWallet(address);
      const tokens = await getWalletBalances(address);
      const sol = tokens.find((token) => token.symbol === "SOL");
      const solBalance = sol?.amount ?? 0;
      const usdBalance = tokens.reduce((sum, token) => sum + token.usdValue, 0);
      wallet.setBalances(solBalance, usdBalance);
      wallet.setTokens(tokens);
    } catch {
      setError("I'm having trouble connecting. Please check your internet.");
    } finally {
      setLoading(false);
    }
  }

  async function connect(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      if (!isMWASupported) {
        const kp = Keypair.generate();
        const address = kp.publicKey.toBase58();
        wallet.setDevWallet(address);
        const tokens = await getWalletBalances(address);
        const sol = tokens.find((token) => token.symbol === "SOL");
        const solBalance = sol?.amount ?? 0;
        const usdBalance = tokens.reduce((sum, token) => sum + token.usdValue, 0);
        wallet.setBalances(solBalance, usdBalance);
        wallet.setTokens(tokens);
        return;
      }

      const {
        transact,
        SolanaMobileWalletAdapterError,
        SolanaMobileWalletAdapterErrorCode,
        SolanaMobileWalletAdapterProtocolError,
        SolanaMobileWalletAdapterProtocolErrorCode,
      } = getMwaModule();

      const authorizationResult = await transact(async (mobileWallet) => {
        const existingAuthToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        const identity = { name: "SolAgent", uri: "https://solagent.app" };
        if (existingAuthToken) {
          try {
            return await mobileWallet.authorize({
              auth_token: existingAuthToken,
              chain: "mainnet-beta",
              identity,
            });
          } catch (reauthorizeError) {
            if (
              reauthorizeError instanceof SolanaMobileWalletAdapterProtocolError &&
              reauthorizeError.code === SolanaMobileWalletAdapterProtocolErrorCode.ERROR_AUTHORIZATION_FAILED
            ) {
              await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            } else {
              throw reauthorizeError;
            }
          }
        }
        return mobileWallet.authorize({ chain: "mainnet-beta", identity });
      });

      const primaryAccount = authorizationResult.accounts[0];
      const address = decodeAddressBase64ToBase58(primaryAccount.address);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, authorizationResult.auth_token);
      wallet.setWallet(address);

      const tokens = await getWalletBalances(address);
      const sol = tokens.find((token) => token.symbol === "SOL");
      wallet.setTokens(tokens);
      wallet.setBalances(sol?.amount ?? 0, tokens.reduce((sum, token) => sum + token.usdValue, 0));
    } catch (caught) {
      if (isMWASupported) {
        const {
          SolanaMobileWalletAdapterError,
          SolanaMobileWalletAdapterErrorCode,
          SolanaMobileWalletAdapterProtocolError,
          SolanaMobileWalletAdapterProtocolErrorCode,
        } = getMwaModule();
        if (
          caught instanceof SolanaMobileWalletAdapterError &&
          caught.code === SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND
        ) {
          setError("No Solana wallet app was found. Please install a wallet and try again.");
          return;
        }
        if (
          caught instanceof SolanaMobileWalletAdapterError &&
          caught.code === SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED
        ) {
          setError("Wallet connection was cancelled.");
          throw new UserRejectedError();
        }
        if (
          caught instanceof SolanaMobileWalletAdapterProtocolError &&
          caught.code === SolanaMobileWalletAdapterProtocolErrorCode.ERROR_AUTHORIZATION_FAILED
        ) {
          await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
          setError("Your wallet session expired. Please reconnect.");
          return;
        }
        setError("I'm having trouble connecting. Please check your internet.");
        throw caught;
      }
      setError("I'm having trouble connecting. Please check your internet.");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      if (isMWASupported) {
        const { transact } = getMwaModule();
        const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (authToken) {
          await transact(async (mobileWallet) => {
            await mobileWallet.deauthorize({ auth_token: authToken });
            return null;
          });
        }
      }
    } catch {
      // We still clear local state on deauth failures.
    } finally {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      wallet.disconnect();
      setLoading(false);
    }
  }

  async function signAndSendTransaction(transaction: VersionedTransaction): Promise<string> {
    if (!wallet.address) throw new WalletNotConnectedError();
    if (!isMWASupported) throw new WalletNotConnectedError();

    const {
      transact,
      SolanaMobileWalletAdapterError,
      SolanaMobileWalletAdapterErrorCode,
      SolanaMobileWalletAdapterProtocolError,
      SolanaMobileWalletAdapterProtocolErrorCode,
    } = getMwaModule();

    try {
      const signature = await transact(async (mobileWallet) => {
        const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        const { signatures } = await mobileWallet.signAndSendTransactions({
          payloads: [Buffer.from(transaction.serialize()).toString("base64")],
          options: { commitment: "confirmed", max_retries: 3 },
        });
        if (authToken) await AsyncStorage.setItem(AUTH_TOKEN_KEY, authToken);
        return bs58.encode(Buffer.from(signatures[0], "base64"));
      });
      await confirmSignature(signature);
      return signature;
    } catch (caught) {
      if (
        caught instanceof SolanaMobileWalletAdapterError &&
        caught.code === SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED
      ) {
        throw new UserRejectedError();
      }
      if (
        caught instanceof SolanaMobileWalletAdapterProtocolError &&
        (caught.code === SolanaMobileWalletAdapterProtocolErrorCode.ERROR_NOT_SUBMITTED ||
          caught.code === SolanaMobileWalletAdapterProtocolErrorCode.ERROR_NOT_SIGNED)
      ) {
        throw new TxFailedError("The transaction didn't go through. Want me to try again?");
      }
      if (
        caught instanceof SolanaMobileWalletAdapterProtocolError &&
        caught.code === SolanaMobileWalletAdapterProtocolErrorCode.ERROR_AUTHORIZATION_FAILED
      ) {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        throw new WalletNotConnectedError();
      }
      if (caught instanceof TxFailedError) throw caught;
      throw new TxFailedError("The transaction failed unexpectedly.");
    }
  }

  async function signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
    if (!wallet.address) throw new WalletNotConnectedError();
    if (!isMWASupported) throw new WalletNotConnectedError();

    const { transact } = getMwaModule();

    const signedBase64 = await transact(async (mobileWallet) => {
      const { signed_payloads } = await mobileWallet.signTransactions({
        payloads: [Buffer.from(transaction.serialize()).toString("base64")],
      });
      return signed_payloads[0];
    });
    return VersionedTransaction.deserialize(Buffer.from(signedBase64, "base64"));
  }

  function getPublicKey(): PublicKey | null {
    if (!wallet.address || !isValidSolanaAddress(wallet.address)) return null;
    return new PublicKey(wallet.address);
  }

  return {
    ...wallet,
    loading,
    error,
    connect,
    connectWithAddress,
    disconnect,
    signAndSendTransaction,
    signTransaction,
    getPublicKey,
  };
}
