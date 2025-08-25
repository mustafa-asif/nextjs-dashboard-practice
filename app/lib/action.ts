'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const sql = postgres(process.env.POSTGRESS_URl!, { ssl :'require'});



const FormSchema=z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce
  .number()
  .gt(0,{message:'Amount must be greater than $0'}),
  status: z.enum(['pending', 'paid'],{
    invalid_type_error: 'Please select a invoice status',
  }),
  date: z.string(),
});

const CreateInvoice=FormSchema.omit({
  id: true,
  date: true,
});

const UpdateInvoice=FormSchema.omit({
  id: true,
  date: true,
});

export type State={
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
}

//auth function to protect actions
export async function authenticate(
  prevState: string | undefined,
  formData: FormData
){
  try {
    await signIn('credentials',formData);
    
  } catch (error) {
    if(error instanceof AuthError){
      switch(error.type){
        case 'CredentialsSignin':
          return "Invalid Credentials";
        default:
          return "Unable to sign in";
      }
    }
    throw error;
  }
}

export async function createInvoice(prevState: State, formData: FormData){
  const validatedFields=CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  console.log(validatedFields)
  // if form validation fails,return error early,otherwise continue
  if(!validatedFields.success){
    return{
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields.Failed to create invoice',
    }
  }

  //prepare data for insertion
  const {customerId,amount,status}=validatedFields.data;

  const amountInCents=amount * 100;
  const date= new Date().toISOString().split('T')[0];

  //sql statement to insert data
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date}) 
      `;
    
  } catch (error) {
    console.error('Error creating invoice:', error);
    
    
  }
// redirect it too dashboard invoices once new invoice submitted
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
   
}

export async function updateInvoice(id:string ,prevState: State,formData: FormData) {
  const validatedFields=UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  console.log(validatedFields)
  // if form validation fails,return error early,otherwise continue
  if(!validatedFields.success){
    return{
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields.Failed to update invoice',
    }
  }
  //prepare data for insertion
  const {customerId,amount,status}=validatedFields.data;
  const amountInCents=amount * 100;

  //sql statement to update data
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
    
  } catch (error) {
    console.error('Error updating invoice:', error);
    
  }
  // redirect it to dashboard invoices once invoice updated
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id:string) {

  try {
    console.log('Invoice deleted successfully');
    await sql`
      DELETE FROM invoices
      WHERE id = ${id}
    `;
    
  } catch (error) {
    console.error('Error deleting invoice:', error);
    
  }
  revalidatePath('/dashboard/invoices');
  
}