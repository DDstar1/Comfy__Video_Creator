// Type for the global injected by Korapay's Standard Checkout script
// (https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js).
// Only the fields this app actually sends/reads are typed; Korapay's own
// script defines the object at runtime, this file only describes it to TS.
export type KorapayChargeResult = {
  amount: number;
  reference: string;
  status: string;
};

export type KorapayInitializeOptions = {
  key: string;
  reference: string;
  amount: number;
  currency: string;
  customer: { name: string; email: string };
  notification_url?: string;
  onSuccess?: (result: KorapayChargeResult) => void;
  onFailed?: (result: KorapayChargeResult) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    Korapay?: { initialize: (options: KorapayInitializeOptions) => void };
  }
}
