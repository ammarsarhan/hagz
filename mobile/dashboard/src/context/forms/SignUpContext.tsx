import { createFormContext } from "@/context/FormContext";
import { SignUpPayload } from "@/lib/types/user";

const initial: SignUpPayload = { firstName: "", lastName: "", role: "OWNER", phone: "", password: ""};
export const { Provider: SignUpFormProvider, useFormContext: useSignUpForm } = createFormContext<SignUpPayload>(initial);
