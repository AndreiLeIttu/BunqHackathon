export interface Person {
  name: string;
  email: string;
}

export interface SplitEntry {
  name: string;
  amount_owed: number;
  justification: string;
  items?: string[];
}

export interface AnalysisResult {
  total_amount: number;
  currency: string;
  restaurant_name?: string;
  splits: SplitEntry[];
  raw_items?: { name: string; price: number }[];
  is_mock?: boolean;
}

export interface BunqContact {
  id: string;
  name: string;
  aliases: { type: string; value: string }[];
  matched?: boolean;
}

export interface RequestStatus {
  name: string;
  status: "pending" | "sent" | "failed" | "mock";
  requestId?: string;
  amount: number;
  currency: string;
  error?: string;
}

export interface SendRequestsPayload {
  splits: SplitEntry[];
  currency: string;
  restaurant_name?: string;
  people?: Person[];
}

export interface SendRequestsResponse {
  results: RequestStatus[];
  success_count: number;
  fail_count: number;
}
