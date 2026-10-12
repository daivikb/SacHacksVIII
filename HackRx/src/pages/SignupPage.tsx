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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  validateResume,
  AGE_RANGES,
  GENDERS,
  GENDER_SELF_DESCRIBE,
  ETHNICITIES,
  INSTITUTIONS,
  INSTITUTION_OTHER,
  ACADEMIC_STANDINGS,
  HIGH_SCHOOL,
  HACKATHON_EXPERIENCE,
  INTEREST_AREAS,
  MOTIVATIONS,
  MAX_MOTIVATIONS,
  TEAM_STATUSES,
  TSHIRT_SIZES,
  DIETARY_OPTIONS,
  DIETARY_OTHER,
  REFERRAL_SOURCES,
  CODE_OF_CONDUCT_URL,
  RESUME_EXTENSIONS,
  type RegisterValues,
} from "@/services/auth.service";

/** Multi-select questions hold a list of answers; everything else below is a string. */
type ListFieldName = "ethnicity" | "interests" | "motivations" | "dietary";
type TextFieldName = Exclude<keyof RegisterValues, ListFieldName | "code_of_conduct">;

type FieldProps = {
  control: Control<RegisterValues>;
  name: TextFieldName;
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

const TextareaField = ({ control, name, label, placeholder }: FieldProps) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Textarea rows={4} placeholder={placeholder} {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

type SelectFieldProps = {
  control: Control<RegisterValues>;
  name: TextFieldName;
  label: string;
  options: string[];
  placeholder?: string;
};

const SelectField = ({ control, name, label, options, placeholder = "Select one" }: SelectFieldProps) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <select {...field}>
            <option value="">{placeholder}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

type CheckGroupProps = {
  control: Control<RegisterValues>;
  name: ListFieldName;
  label: string;
  options: string[];
  /** Once this many are ticked, the remaining boxes are disabled. */
  max?: number;
};

const CheckGroup = ({ control, name, label, options, max }: CheckGroupProps) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <div className="portal-checks">
          {options.map((o) => {
            const checked = field.value.includes(o);
            return (
              <label key={o}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && max !== undefined && field.value.length >= max}
                  onChange={(e) =>
                    field.onChange(
                      e.target.checked
                        ? [...field.value, o]
                        : field.value.filter((v) => v !== o),
                    )
                  }
                />
                {o}
              </label>
            );
          })}
        </div>
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
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      age_range: "",
      gender: "",
      gender_self: "",
      ethnicity: [],
      institution: "",
      institution_other: "",
      academic_standing: "",
      high_school_case: "",
      major: "",
      first_hackathon: "",
      interests: [],
      motivations: [],
      github: "",
      code_of_conduct: false,
      signature: "",
      team_status: "",
      tshirt_size: "",
      dietary: [],
      dietary_other: "",
      referral_source: "",
      goals: "",
      additional_info: "",
      password: "",
      confirmPassword: "",
    },
  });
  const gender = form.watch("gender");
  const institution = form.watch("institution");
  const standing = form.watch("academic_standing");
  const dietary = form.watch("dietary");

  // Already signed in (and not mid-submission): nothing to do here.
  if (!loading && user && !busy) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: RegisterValues) => {
    const fileError = validateResume(resume);
    setResumeError(fileError);
    if (fileError || !resume) return;

    setBusy(true);
    const error = await register(values, resume);
    if (error) {
      setBusy(false);
      toast({ title: "Application not submitted", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Application submitted", description: "Your application is awaiting a decision." });
    navigate("/dashboard");
  };

  // Surface a missing résumé alongside the other validation errors.
  const onInvalid = () => setResumeError(validateResume(resume));

  return (
    <Layout portal>
      <section className="panel chapter portal">
        <PortalDecor />
        <span className="eyebrow">Application submission</span>
        <h1 className="chapter-title">Participant application</h1>
        <p className="chapter-sub">
          Thank you for your interest in SacHacks. Please complete the application below; the
          organising committee will review your responses.
        </p>

        <Form {...form}>
          <form className="portal-forms" onSubmit={form.handleSubmit(onSubmit, onInvalid)} noValidate>
            <article className="portal-card">
              <h2>1. Basic information</h2>
              <Field control={form.control} name="full_name" label="Full legal name" autoComplete="name" placeholder="Jane Doe" />
              <Field control={form.control} name="email" label="Email address (an .edu address is preferred)" type="email" autoComplete="email" placeholder="you@school.edu" />
              <Field control={form.control} name="phone" label="Telephone number (optional)" type="tel" autoComplete="tel" placeholder="(530) 555-0123" />
              <SelectField control={form.control} name="age_range" label="Please indicate your age range" options={AGE_RANGES} />
              <SelectField control={form.control} name="gender" label="Gender identity (optional)" options={GENDERS} placeholder="No response" />
              {gender === GENDER_SELF_DESCRIBE && (
                <Field control={form.control} name="gender_self" label="Please describe your gender identity" />
              )}
              <CheckGroup control={form.control} name="ethnicity" label="Race / ethnicity (optional — select all that apply)" options={ETHNICITIES} />
            </article>

            <article className="portal-card">
              <h2>2. Education &amp; background</h2>
              <SelectField control={form.control} name="institution" label="Which school or institution do you currently attend?" options={INSTITUTIONS} />
              {institution === INSTITUTION_OTHER && (
                <Field control={form.control} name="institution_other" label="Please specify your school or institution" autoComplete="organization" />
              )}
              <SelectField control={form.control} name="academic_standing" label="What is your current academic standing?" options={ACADEMIC_STANDINGS} />
              {standing === HIGH_SCHOOL && (
                <TextareaField
                  control={form.control}
                  name="high_school_case"
                  label="As a high school applicant, please explain why you would be a strong fit for this event"
                />
              )}
              <Field control={form.control} name="major" label="What is your major or field of study?" placeholder="Enter N/A if not applicable" />
            </article>

            <article className="portal-card">
              <h2>3. Hackathon experience &amp; interests</h2>
              <SelectField control={form.control} name="first_hackathon" label="Will this be your first hackathon?" options={HACKATHON_EXPERIENCE} />
              <CheckGroup control={form.control} name="interests" label="Which areas are of greatest interest to you? (select all that apply)" options={INTEREST_AREAS} />
              <CheckGroup
                control={form.control}
                name="motivations"
                label={`What do you most look forward to at SacHacks? (select up to ${MAX_MOTIVATIONS})`}
                options={MOTIVATIONS}
                max={MAX_MOTIVATIONS}
              />
              <Label htmlFor="resume">Please upload your résumé (PDF or Word, 5 MB maximum)</Label>
              <input
                id="resume"
                type="file"
                accept={RESUME_EXTENSIONS.join(",")}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setResume(file);
                  setResumeError(validateResume(file));
                }}
              />
              {resumeError && <p className="portal-error">{resumeError}</p>}
              <Field control={form.control} name="github" label="GitHub profile link (if applicable)" type="url" placeholder="https://github.com/username" />
            </article>

            <article className="portal-card">
              <h2>4. Team &amp; event logistics</h2>
              <SelectField control={form.control} name="team_status" label="Have you already formed a team?" options={TEAM_STATUSES} />
              <SelectField control={form.control} name="tshirt_size" label="What is your T-shirt size?" options={TSHIRT_SIZES} />
              <CheckGroup control={form.control} name="dietary" label="Do you have any dietary restrictions? (optional — select all that apply)" options={DIETARY_OPTIONS} />
              {dietary.includes(DIETARY_OTHER) && (
                <Field control={form.control} name="dietary_other" label="Please specify your dietary restriction" />
              )}
            </article>

            <article className="portal-card">
              <h2>5. Final questions</h2>
              <SelectField control={form.control} name="referral_source" label="How did you learn about SacHacks?" options={REFERRAL_SOURCES} />
              <TextareaField control={form.control} name="goals" label="What do you hope to gain from this experience? (optional)" />
              <TextareaField control={form.control} name="additional_info" label="Is there anything else you would like us to know? (optional)" />
            </article>

            <article className="portal-card">
              <h2>6. Agreements &amp; submission</h2>
              <FormField
                control={form.control}
                name="code_of_conduct"
                render={({ field }) => (
                  <FormItem>
                    <div className="portal-checks">
                      <label>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                        I have read and agree to the SacHacks Code of Conduct.
                      </label>
                    </div>
                    <p className="portal-note">
                      <a href={CODE_OF_CONDUCT_URL} target="_blank" rel="noopener noreferrer">
                        Read the Code of Conduct
                      </a>
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="portal-note">By typing your full name below, you agree to the following statements:</p>
              <ul className="portal-note">
                <li>
                  I authorise SacHacks to send me occasional emails regarding relevant events,
                  career opportunities, and community announcements.
                </li>
                <li>
                  I authorise SacHacks to share my résumé with sponsors who may be interested in
                  hiring me.
                </li>
                <li>
                  I understand that SacHacks does not guarantee employment, interviews, or any
                  further communication from its sponsors.
                </li>
              </ul>
              <Field control={form.control} name="signature" label="Full name (electronic signature)" autoComplete="name" />
              <Field control={form.control} name="password" label="Create a password for your account" type="password" autoComplete="new-password" placeholder="At least 8 characters" />
              <Field control={form.control} name="confirmPassword" label="Confirm your password" type="password" autoComplete="new-password" />
              <Button type="submit" className="venom-submit" disabled={busy} {...submitTriggers}>
                {busy ? "Submitting..." : "Submit application"}
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
