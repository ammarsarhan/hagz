import {
  createFormContext,
  createFormContextHook,
  FormContextProvider,
} from '@/context/FormContext';
import { SignUpPayload } from '@/lib/types/user';

const initial: SignUpPayload = {
  firstName: '',
  lastName: '',
  role: null,
  phone: '',
  password: '',
  confirmPassword: '',
};

export const SignUpContext = createFormContext<SignUpPayload>();
export const useSignUpForm = createFormContextHook(SignUpContext);

export function SignUpProvider({ children }: { children: React.ReactNode }) {
  return (
    <FormContextProvider context={SignUpContext} initial={initial}>
      {children}
    </FormContextProvider>
  );
}
