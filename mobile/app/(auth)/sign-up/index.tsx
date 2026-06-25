import useFormContext from '@/context/FormContext';

export default function SignUp() {
    const { currentStep } = useFormContext();

    return (
        <>
            {currentStep}
        </>
    );
}
