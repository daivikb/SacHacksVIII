import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Control } from "react-hook-form";
import { Layout } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { useRegistrationDialog } from "@/context/registration-context";
import { useToast } from "@/hooks/use-toast";
import { useGlitchTriggers } from "@/hooks/useGlitchTriggers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  register,
  registerSchema,
  type RegisterValues,
} from "@/services/auth.service";

type FieldProps = {
  control: Control<RegisterValues>;
  name: keyof RegisterValues;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
};

const Field = ({ control, name, label, type = "text", autoComplete, placeholder }: FieldProps) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input type={type} autoComplete={autoComplete} placeholder={placeholder} {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const SignupPage = () => {
  const { user, loading } = useAuth();
  const { openAuth } = useRegistrationDialog();
  const { toast } = useToast();
  const navigate = useNavigate();
  const submitTriggers = useGlitchTriggers();
  const [busy, setBusy] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      username: "",
      institution: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Already signed in (and not mid-registration): nothing to do here.
  if (!loading && user && !busy) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: RegisterValues) => {
    setBusy(true);
    const error = await register(values);
    if (error) {
      setBusy(false);
      toast({ title: "Sign up failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "You're registered", description: "Your application is awaiting a decision." });
    navigate("/dashboard");
  };

  return (
    <Layout portal>
      <section className="panel chapter portal">
        <PortalDecor />
        <span className="eyebrow">Register</span>
        <h1 className="chapter-title">Create your account</h1>
        <p className="chapter-sub">Tell us who you are — organisers review these details.</p>

        <Form {...form}>
          <form className="portal-forms" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <article className="portal-card">
              <h2>Your details</h2>
              <Field control={form.control} name="full_name" label="Full name" autoComplete="name" placeholder="Jane Doe" />
              <Field control={form.control} name="username" label="Username (optional)" autoComplete="username" placeholder="janedoe" />
              <Field control={form.control} name="institution" label="School / organisation" autoComplete="organization" placeholder="UC Davis" />
            </article>

            <article className="portal-card">
              <h2>Login</h2>
              <Field control={form.control} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
              <Field control={form.control} name="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" />
              <Field control={form.control} name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" />
              <Button type="submit" className="venom-submit" disabled={busy} {...submitTriggers}>
                {busy ? "Working..." : "Register now"}
              </Button>
              <p className="venom-switch">
                Already have an account?{" "}
                <button type="button" onClick={() => openAuth("login")}>Log in instead</button>
              </p>
            </article>
          </form>
        </Form>
      </section>
    </Layout>
  );
};

export default SignupPage;
