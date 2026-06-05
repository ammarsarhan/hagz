import Avatar from '#/components/shared/Avatar';
import Button from '#/components/shared/Button';
import Input from '#/components/shared/Input'
import { useForm, useStore } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react';
import { TbArrowRight, TbExclamationCircle, TbUpload } from 'react-icons/tb';

export const Route = createFileRoute('/_app/account/')({
  component: RouteComponent
})

function RouteComponent() {
  const { user } = Route.useRouteContext();
  
  const initial = {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone.slice(3),
    email: user.email ?? ""
  };

  const form = useForm({
    defaultValues: initial,
    validators: {
      // onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {

    }
  });

  const values = useStore(form.store, (s) => s.values);
  const isChanged = JSON.stringify(values) !== JSON.stringify(initial);
  
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = () => {
    
  };

  return (
    <main className='px-4 py-10 w-full text-base'>
      <div className='flex flex-col gap-y-px w-full'>
        <h1 className='text-lg font-medium'>Profile</h1>
        <span className='text-gray-500 text-sm'>Track account status and update your name, phone number, email, etc...</span>
      </div>
      <form 
        className='flex flex-col gap-y-4 my-8' 
        onSubmit={(e) => { 
          e.preventDefault(); 
          form.handleSubmit(); 
        }}
      >
        <div className='flex gap-x-12 py-4'>
          <div className="w-1/2 flex items-center">
            <span className='font-medium'>Account Status</span>
          </div>
          <div className="w-1/2 flex gap-x-4">
            {
              !user.isVerified ?
              <div className='flex items-center gap-x-3.5'>
                <TbExclamationCircle className='text-gray-500 size-5 shrink-0'/>  
                <div className='flex flex-col gap-y-1.5'>
                  <p className='text-gray-500 text-sm'>Your account has not been verified yet. You will need to verify your phone number before making a booking.</p>
                  <Link to="/auth/verify/send" className='text-primary-muted hover:underline text-sm w-fit flex items-center gap-x-1 group'>Verify phone <TbArrowRight className='group-hover:-rotate-45 transition' /></Link>
                </div>
              </div> :
              <div className='flex flex-col gap-y-2'>
                <p className='text-gray-500 text-sm'>Your account has been verified successfully, is active, and is ready to book!</p>
                <Link to="/pitches/search" className='text-primary-muted hover:underline text-sm w-fit flex items-center gap-x-1 group'>Explore pitches</Link>
              </div>
            }
          </div>
        </div>
        <div className='flex gap-x-12 py-4'>
          <div className="flex flex-col gap-y-0.5 w-1/2">
            <span className='font-medium'>Name</span>
            <p className='text-gray-500 text-sm'>Display name that will be shown on any bookings and payments on your part.</p>
          </div>
          <div className="w-1/2 flex gap-x-4">
            <form.Field
              name="firstName"
              children={(field) => <Input label="First Name" placeholder='First name' value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className='flex-1'/>}
            />
            <form.Field
              name="lastName"
              children={(field) => <Input label="Last Name" placeholder='Last name' value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className='flex-1'/>}
            />
          </div>
        </div>
        <div className='flex gap-x-12 py-4'>
          <div className="flex flex-col gap-y-0.5 w-1/2">
            <span className='font-medium'>Profile Picture</span>
            <p className='text-gray-500 text-sm'>Adding a picture helps venues identify you more accurately, making booking verification easier on their part.</p>
          </div>
          <div className="w-1/2 flex items-center justify-between">
            <div className="flex-center gap-x-2.5">
              <Avatar label={user.firstName[0]}/>
              <div className='flex flex-col'>
                <span className='text-sm text-gray-500'>Profile picture not provided.</span>
              </div>
            </div>
            <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                ref={uploadRef}
                onChange={handleFileChange}
            />
            <Button className='border-gray-200! hover:bg-gray-50' onClick={() => uploadRef.current?.click()}>
              <TbUpload />
              <span className='text-[0.8125rem]'>Upload</span>
            </Button>
          </div>
        </div>
        <div className='flex gap-x-12 py-4'>
          <div className="flex flex-col gap-y-0.5 w-1/2">
            <span className='font-medium'>Phone Number</span>
            <p className='text-gray-500 text-sm'>Phone number that will be used to authenticate with and recieve booking updates.</p>
          </div>
          <div className="w-1/2 flex gap-x-4">
            <form.Field
              name="phone"
              children={(field) => <Input type="phone" label="Phone Number" placeholder='Phone' value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className='flex-1'/>}
            />
          </div>
        </div>
        <div className='flex gap-x-12 py-4'>
          <div className="flex flex-col gap-y-0.5 w-1/2">
            <span className='font-medium'>Email Address</span>
            <p className='text-gray-500 text-sm'>Email that will be used to recieve booking updates and special offers.</p>
          </div>
          <div className="w-1/2 flex gap-x-4">
            <form.Field
              name="email"
              children={(field) => <Input label="Email" placeholder='Email address' value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className='flex-1'/>}
            />
          </div>
        </div>
        <div className='py-4 flex items-center justify-end'>
          <Button className={`${isChanged ? "cursor-pointer bg-primary hover:bg-primary/75" : "bg-gray-200 cursor-not-allowed!"}`} type="submit">
            <span className='text-sm font-medium'>Save changes</span>
          </Button>
        </div>
      </form>
    </main>
  )
}
