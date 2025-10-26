import { TargetOption } from "@/app/context/useBookingContext";

export interface CreateBookingPayload {
    source: "PLATFORM" | "IN_PERSON" | "PHONE" | "OTHER";
    target: TargetOption;
};

export type CreateBookingAction =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: "SET"; field: string; value: any }
  | { type: "RESET" }
  | { type: "UPDATE"; payload: Partial<CreateBookingPayload> };

export function createBookingReducer(state: CreateBookingPayload, action: CreateBookingAction): CreateBookingPayload {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };

    case "UPDATE":
      return { ...state, ...action.payload };

    default:
      return state;
  }
}