import Alert from '#/components/shared/Alert';
import Button from '#/components/shared/Button';
import Input from '#/components/shared/Input';
import { client, ERROR_CODES, type ErrorResponse } from '#/lib/client';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react';
import { TbBallFootball, TbUser, TbUsers } from 'react-icons/tb';
import z from 'zod';

export const Route = createFileRoute('/auth/sign-up')({
  component: RouteComponent,
})

const signUpSchema = z.object({
  firstName: z
      .string("Please enter a valid first name.")
      .min(2, "First name must be at least 2 characters long.")
      .max(100, "First name must be 100 characters long at most."),
  lastName: z
      .string("Please enter a valid last name.")
      .min(2, "Last name must be at least 2 characters long.")
      .max(100, "Last name must be 100 characters long at most."),
  phone: z
      .string("Phone number is required.")
      .transform((val) => val.startsWith('+') ? val : `+20${val}`)
      .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in the correct format.")),
  password: z
      .string("Password is required.")
      .min(1, "Password is required.")
      .max(100, "Password may not be longer than 100 characters."),
  confirmPassword: z
      .string("Password is required.")
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) 
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Both passwords do not match." });
});

function RouteComponent() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [role, setRole] = useState<"User" | "Owner">("User");
  const [error, setError] = useState<{ message: string, code?: string } | null>(null);

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      confirmPassword: ''
    },
    validators: {
      onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        phone: value.phone.startsWith('+') ? value.phone : `+20${value.phone}`,
      };

      const res = await client.auth['sign-up'].$post({ json: payload });
      
      if (!res.ok) {
        const data = await res.json() as unknown as ErrorResponse;

        const code = data.error.code;
        let message = "An unknown error has occurred.";

        if (code) message = ERROR_CODES[code];
        
        setError({ message, code });
        return;
      };

      let redirectPath = "/";
      if (role == "Owner") redirectPath = "/dashboard/pitches/create";

      await navigate({ to: redirectPath });
    }
  });

  return (
    <>
      {error && <Alert {...error} onClose={() => setError(null)}/>}
      <div className='p-4 h-screen flex gap-x-4'>
        <div className='h-full flex-center relative w-4/5 bg-gray-50 rounded-md p-4 overflow-clip'>
          <TbBallFootball className='absolute -bottom-24 -right-24 size-96 text-primary-muted opacity-5 z-0'/>
          <Link to="/" className='absolute top-4 left-4'>
              <div className="flex-center size-10 rounded-md bg-primary">
                  <TbBallFootball className="size-6.5" strokeWidth={2}/>
              </div>
          </Link>
          <form 
            className='w-md'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className='flex flex-col gap-y-2 mb-6'>
              <h1 className='text-3xl font-medium'>Create An Account</h1>
              <p className='text-gray-500 text-base'>Already have an account? <Link to="/auth/sign-in" className='text-primary-muted hover:underline'>Sign in</Link></p>
            </div>
            <div className='flex gap-x-4 mb-6'>
              <div onClick={() => setRole("User")} className='cursor-pointer relative p-4 rounded-md bg-linear-to-br from-gray-100 to-white border border-gray-200 w-full'>
                <div className='flex flex-col gap-y-0.5'>
                  <div className='size-8 rounded-md border border-gray-200 flex-center mb-2.5 bg-white'>
                    <TbUser/>
                  </div>
                  <span className='font-medium text-sm'>I am a user</span>
                  <p className='text-xs text-gray-500'>I want to find pitches and book.</p>
                </div>
                <input type="radio" readOnly checked={role === "User"} className='absolute top-4 right-4 accent-primary-muted'/>
              </div>
              <div onClick={() => setRole("Owner")} className='cursor-pointer relative p-4 rounded-md bg-linear-to-br from-gray-100 to-white border border-gray-200 w-full'>
                <div className='flex flex-col gap-y-0.5'>
                  <div className='size-8 rounded-md border border-gray-200 flex-center mb-2.5 bg-white'>
                    <TbUsers/>
                  </div>
                  <span className='font-medium text-sm'>I am an owner</span>
                  <p className='text-xs text-gray-500'>I want to add my venue.</p>
                </div>
                <input type="radio" readOnly checked={role === "Owner"} className='absolute top-4 right-4 accent-primary-muted'/>
              </div>
            </div>
            <div className='flex flex-col gap-y-4'>
              <div className='flex gap-x-4'>
                <form.Field
                  name="firstName"
                  children={(field) => {
                    return (
                      <Input 
                        label="First Name"
                        placeholder="First Name" 
                        value={field.state.value} 
                        onChange={(e) => field.handleChange(e.target.value)}
                        error={field.state.meta.errors[0]?.message}
                        className='w-full'
                      />
                    )
                  }}
                />
                <form.Field
                  name="lastName"
                  children={(field) => {
                    return (
                      <Input 
                        label="Last Name"
                        placeholder="Last Name" 
                        value={field.state.value} 
                        onChange={(e) => field.handleChange(e.target.value)}
                        error={field.state.meta.errors[0]?.message}
                        className='w-full'
                      />
                    )
                  }}
                />
              </div>
              <form.Field
                name="phone"
                children={(field) => {
                  return (
                    <Input 
                      label="Phone"
                      placeholder="Phone Number" 
                      value={field.state.value} 
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="phone"
                      error={field.state.meta.errors[0]?.message}
                    />
                  )
                }}
              />
              <form.Field
                name="password"
                children={(field) => {
                  return (
                    <Input 
                      label="Password"
                      placeholder="Password" 
                      value={field.state.value} 
                      onChange={(e) => field.handleChange(e.target.value)}
                      type={isVisible ? "text" : "password"}
                      error={field.state.meta.errors[0]?.message}
                    />
                  )
                }}
              />
              <form.Field
                name="confirmPassword"
                children={(field) => {
                  return (
                    <div className='flex flex-col gap-y-4'> 
                      <Input 
                        label="Confirm Password"
                        placeholder="Password" 
                        value={field.state.value} 
                        onChange={(e) => field.handleChange(e.target.value)}
                        type={isVisible ? "text" : "password"}
                        error={field.state.meta.errors[0]?.message}
                      />
                      <div className='flex items-center gap-x-1.5'>
                        <input type="checkbox" className='accent-primary-muted' checked={isVisible} onChange={() => setIsVisible(v => !v)}/>
                        <span className='text-sm'>Show password</span>
                      </div>
                    </div>
                  )
                }}
              />
              <form.Subscribe selector={(state) => [state.isSubmitting]}>
                {
                  ([isSubmitting]) => (
                    <Button disabled={isSubmitting} type="submit" className={`mx-auto mt-4 ${isSubmitting ? "bg-primary/75 cursor-wait" : "bg-primary hover:bg-primary/75"}`}>
                      <span className='text-base'>{isSubmitting ? "Loading..." : "Sign up"}</span>
                    </Button>
                  )
                }
              </form.Subscribe>
            </div>
          </form>
          <span className='text-gray-500 absolute bottom-4 text-xs'>© Hagz 2026. All rights reserved.</span>
        </div>
        <div className='h-full w-1/5 bg-gray-50 rounded-md p-4'>

        </div>
      </div>
    </>
  )
}
