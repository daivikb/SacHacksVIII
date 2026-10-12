import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Control, type FieldErrors } from "react-hook-form";
import { Layout } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useGlitchTriggers } from "@/hooks/useGlitchTriggers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  submitApplication,
  applicationSchema,
  fetchApplicationStatus,
  fetchProfile,
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
  type ApplicationValues,
} from "@/services/auth.service";

/** Multi-select questions hold a list of answers; everything else below is a string. */
type ListFieldName = "ethnicity" | "interests" | "motivations" | "dietary";
type TextFieldName = Exclude<keyof ApplicationValues, ListFieldName | "code_of_conduct">;

const LONG_ANSWER_MAX = 2000;

/** The form is answered one section at a time; `fields` are validated before moving on. */
const STEPS: { title: string; fields: (keyof ApplicationValues)[] }[] = [
  {
    title: "Basic information",
    fields: ["full_name", "phone", "age_range", "gender", "gender_self", "ethnicity"],
  },
  {
    title: "Education & background",
    fields: ["institution", "institution_other", "academic_standing", "high_school_case", "major"],
  },
  {
    title: "Hackathon experience & interests",
    fields: ["first_hackathon", "interests", "motivations", "resume_link", "github"],
  },
  {
    title: "Team & event logistics",
    fields: ["team_status", "tshirt_size", "dietary", "dietary_other"],
  },
  {
    title: "Final questions",
    fields: ["referral_source", "goals", "additional_info"],
  },
  {
    title: "Agreements & submission",
    fields: ["code_of_conduct", "signature"],
  },
];

const QuestionTitle = ({ label, required }: { label: string; required?: boolean }) => (
  <FormLabel className="gform-title">
    {label}
    {required && <span className="gform-required" aria-hidden="true"> *</span>}
  </FormLabel>
);

type QuestionProps = {
  control: Control<ApplicationValues>;
  label: string;
  required?: boolean;
  /** Follow-up questions render inside the card of the answer that revealed them. */
  nested?: boolean;
  /** Follow-up questions revealed by this one's answer. */
  children?: ReactNode;
};

const QuestionCard = ({ nested, children }: { nested?: boolean; children: ReactNode }) => (
  <div className={nested ? "gform-followup" : "gform-q"}>{children}</div>
);

type TextQuestionProps = QuestionProps & {
  name: TextFieldName;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
};

const TextQuestion = ({
  control, name, label, required, nested, children, type = "text", autoComplete, placeholder = "Your answer",
}: TextQuestionProps) => (
  <QuestionCard nested={nested}>
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <QuestionTitle label={label} required={required} />
          <FormControl>
            <Input className="gform-input" type={type} autoComplete={autoComplete} placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    {children}
  </QuestionCard>
);

const LongQuestion = ({ control, name, label, required, nested }: QuestionProps & { name: TextFieldName }) => (
  <QuestionCard nested={nested}>
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <QuestionTitle label={label} required={required} />
          <FormControl>
            <Textarea className="gform-input" rows={3} maxLength={LONG_ANSWER_MAX} placeholder="Your answer" {...field} />
          </FormControl>
          <div className="gform-foot">
            <FormMessage />
            <span className="gform-count">{field.value.length} / {LONG_ANSWER_MAX}</span>
          </div>
        </FormItem>
      )}
    />
  </QuestionCard>
);

type ChoiceQuestionProps = QuestionProps & {
  name: TextFieldName;
  options: string[];
  /** Short answers (sizes, ranges) read better as a row of chips than a list. */
  chips?: boolean;
};

const ChoiceQuestion = ({ control, name, label, required, options, chips, children }: ChoiceQuestionProps) => (
  <QuestionCard>
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <QuestionTitle label={label} required={required} />
          <FormControl>
            <div className={chips ? "gform-chips" : "gform-options"} role="radiogroup" aria-label={label}>
              {options.map((o) => (
                <label key={o} className={`gform-option${field.value === o ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name={field.name}
                    value={o}
                    checked={field.value === o}
                    onChange={() => field.onChange(o)}
                    onBlur={field.onBlur}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </FormControl>
          <div className="gform-foot">
            <FormMessage />
            {!required && field.value && (
              <button type="button" className="gform-clear" onClick={() => field.onChange("")}>
                Clear selection
              </button>
            )}
          </div>
        </FormItem>
      )}
    />
    {children}
  </QuestionCard>
);

const DropdownQuestion = ({ control, name, label, required, options }: ChoiceQuestionProps) => (
  <QuestionCard>
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <QuestionTitle label={label} required={required} />
          <FormControl>
            <select className="gform-select" {...field}>
              <option value="">Choose</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </QuestionCard>
);

type CheckQuestionProps = QuestionProps & {
  name: ListFieldName;
  options: string[];
  /** Once this many are ticked, the remaining boxes are disabled. */
  max?: number;
};

const CheckQuestion = ({ control, name, label, required, options, max, children }: CheckQuestionProps) => (
  <QuestionCard>
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <QuestionTitle label={label} required={required} />
          <FormControl>
            <div className="gform-options" role="group" aria-label={label}>
              {options.map((o) => {
                const checked = field.value.includes(o);
                const disabled = !checked && max !== undefined && field.value.length >= max;
                return (
                  <label
                    key={o}
                    className={`gform-option${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked
                            ? [...field.value, o]
                            : field.value.filter((v) => v !== o),
                        )
                      }
                      onBlur={field.onBlur}
                    />
                    <span>{o}</span>
                  </label>
                );
              })}
            </div>
          </FormControl>
          <div className="gform-foot">
            <FormMessage />
            {max !== undefined && (
              <span className="gform-count">{field.value.length} of {max} selected</span>
            )}
          </div>
        </FormItem>
      )}
    />
    {children}
  </QuestionCard>
);

const SignupPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const submitTriggers = useGlitchTriggers();
  const [busy, setBusy] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [step, setStep] = useState(0);
  // Sections already reached can be revisited from the step markers.
  const [furthest, setFurthest] = useState(0);
  const topRef = useRef<HTMLFormElement>(null);

  const form = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: "",
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
      resume_link: "",
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
    },
  });
  const gender = form.watch("gender");
  const institution = form.watch("institution");
  const standing = form.watch("academic_standing");
  const dietary = form.watch("dietary");

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchApplicationStatus(user.uid).then((status) => {
      if (active && status) setAlreadyApplied(true);
    });
    void fetchProfile(user.uid).then((p) => {
      if (active && p?.full_name && !form.getValues("full_name")) {
        form.setValue("full_name", p.full_name);
      }
    });
    return () => { active = false; };
  }, [user, form]);

  // An answer's error goes away as soon as that answer is edited.
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (name) form.clearErrors(name);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // One application per hacker — resubmitting would overwrite a reviewed one.
  if (alreadyApplied && !busy) return <Navigate to="/dashboard" replace />;

  const isLast = step === STEPS.length - 1;

  const goTo = (next: number) => {
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const showFirstError = () =>
    requestAnimationFrame(() =>
      document
        .querySelector('.gform-q:has([aria-invalid="true"])')
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );

  /**
   * Follow-up answers the schema only requires once the whole form parses, so
   * they are checked here to be caught on the section they belong to.
   */
  const checkFollowUps = () => {
    const v = form.getValues();
    const missing: [TextFieldName, string][] = [];
    if (step === 1 && v.institution === INSTITUTION_OTHER && !v.institution_other.trim()) {
      missing.push(["institution_other", "Tell us which school or institution"]);
    }
    if (step === 1 && v.academic_standing === HIGH_SCHOOL && !v.high_school_case.trim()) {
      missing.push(["high_school_case", "High school applicants must complete this statement"]);
    }
    if (step === 3 && v.dietary.includes(DIETARY_OTHER) && !v.dietary_other.trim()) {
      missing.push(["dietary_other", "Please specify your dietary restriction"]);
    }
    missing.forEach(([name, message]) => form.setError(name, { type: "manual", message }));
    return missing.length === 0;
  };

  const onNext = async () => {
    let ok = await form.trigger(STEPS[step].fields);
    if (!checkFollowUps()) ok = false;
    if (ok) goTo(step + 1);
    else showFirstError();
  };

  const onSubmit = async (values: ApplicationValues) => {
    setBusy(true);
    const error = await submitApplication(values);
    if (error) {
      setBusy(false);
      toast({ title: "Application not submitted", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Application submitted", description: "Your application is awaiting a decision." });
    navigate("/dashboard");
  };

  // Jump back to the first section that still has a problem.
  const onInvalid = (errors: FieldErrors<ApplicationValues>) => {
    const invalid = STEPS.findIndex((s) => s.fields.some((f) => errors[f]));
    if (invalid >= 0 && invalid !== step) setStep(invalid);
    showFirstError();
  };

  const control = form.control;

  return (
    <Layout portal>
      <section className="panel chapter portal apply">
        <PortalDecor />
        <span className="eyebrow">Application submission</span>
        <h1 className="chapter-title">Participant application</h1>

        <Form {...form}>
          <form
            ref={topRef}
            className="gform"
            onSubmit={(e) => {
              // Enter in a text answer moves on rather than submitting half a form.
              if (isLast) return void form.handleSubmit(onSubmit, onInvalid)(e);
              e.preventDefault();
              void onNext();
            }}
            noValidate
          >
            <header className="gform-head">
              <div className="gform-head-row">
                <h2>{STEPS[step].title}</h2>
                <span className="gform-count">Section {step + 1} of {STEPS.length}</span>
              </div>
              <div
                className="gform-progress"
                role="progressbar"
                aria-label="Application progress"
                aria-valuemin={1}
                aria-valuemax={STEPS.length}
                aria-valuenow={step + 1}
              >
                <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <ol className="gform-steps">
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <button
                      type="button"
                      className={i === step ? "is-current" : i <= furthest ? "is-done" : undefined}
                      disabled={i > furthest || busy}
                      aria-current={i === step ? "step" : undefined}
                      aria-label={`Section ${i + 1}: ${s.title}`}
                      title={s.title}
                      onClick={() => goTo(i)}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="gform-hint"><span className="gform-required">*</span> Indicates a required question</p>
            </header>

            <div className="gform-section" key={step}>
              {step === 0 && (
                <>
                  <TextQuestion control={control} name="full_name" label="Full legal name" required autoComplete="name" />
                  <TextQuestion control={control} name="phone" label="Telephone number" type="tel" autoComplete="tel" placeholder="(530) 555-0123" />
                  <ChoiceQuestion control={control} name="age_range" label="Please indicate your age range" required options={AGE_RANGES} chips />
                  <ChoiceQuestion control={control} name="gender" label="Gender identity" options={GENDERS}>
                    {gender === GENDER_SELF_DESCRIBE && (
                      <TextQuestion control={control} name="gender_self" label="Please describe your gender identity" nested />
                    )}
                  </ChoiceQuestion>
                  <CheckQuestion control={control} name="ethnicity" label="Race / ethnicity (select all that apply)" options={ETHNICITIES} />
                </>
              )}

              {step === 1 && (
                <>
                  <ChoiceQuestion control={control} name="institution" label="Which school or institution do you currently attend?" required options={INSTITUTIONS}>
                    {institution === INSTITUTION_OTHER && (
                      <TextQuestion control={control} name="institution_other" label="Please specify your school or institution" required nested autoComplete="organization" />
                    )}
                  </ChoiceQuestion>
                  <ChoiceQuestion control={control} name="academic_standing" label="What is your current academic standing?" required options={ACADEMIC_STANDINGS}>
                    {standing === HIGH_SCHOOL && (
                      <LongQuestion
                        control={control}
                        name="high_school_case"
                        label="As a high school applicant, please explain why you would be a strong fit for this event"
                        required
                        nested
                      />
                    )}
                  </ChoiceQuestion>
                  <TextQuestion control={control} name="major" label="What is your major or field of study?" required placeholder="Enter N/A if not applicable" />
                </>
              )}

              {step === 2 && (
                <>
                  <ChoiceQuestion control={control} name="first_hackathon" label="Will this be your first hackathon?" required options={HACKATHON_EXPERIENCE} />
                  <CheckQuestion control={control} name="interests" label="Which areas are of greatest interest to you? (select all that apply)" required options={INTEREST_AREAS} />
                  <CheckQuestion
                    control={control}
                    name="motivations"
                    label={`What do you most look forward to at SacHacks? (select up to ${MAX_MOTIVATIONS})`}
                    required
                    options={MOTIVATIONS}
                    max={MAX_MOTIVATIONS}
                  />
                  <TextQuestion
                    control={control}
                    name="resume_link"
                    label="Please provide a link to your résumé (e.g. Google Drive or Dropbox, with viewing access enabled)"
                    required
                    type="url"
                    placeholder="https://drive.google.com/..."
                  />
                  <TextQuestion control={control} name="github" label="GitHub profile link (if applicable)" type="url" placeholder="https://github.com/username" />
                </>
              )}

              {step === 3 && (
                <>
                  <ChoiceQuestion control={control} name="team_status" label="Would you prefer to be on a team or solo?" required options={TEAM_STATUSES} />
                  <ChoiceQuestion control={control} name="tshirt_size" label="What is your T-shirt size?" required options={TSHIRT_SIZES} chips />
                  <CheckQuestion control={control} name="dietary" label="Do you have any dietary restrictions? (select all that apply)" options={DIETARY_OPTIONS}>
                    {dietary.includes(DIETARY_OTHER) && (
                      <TextQuestion control={control} name="dietary_other" label="Please specify your dietary restriction" required nested />
                    )}
                  </CheckQuestion>
                </>
              )}

              {step === 4 && (
                <>
                  <DropdownQuestion control={control} name="referral_source" label="How did you learn about SacHacks?" required options={REFERRAL_SOURCES} />
                  <LongQuestion control={control} name="goals" label="What do you hope to gain from this experience?" />
                  <LongQuestion control={control} name="additional_info" label="Is there anything else you would like us to know?" />
                </>
              )}

              {step === 5 && (
                <>
                  <div className="gform-q">
                    <FormField
                      control={control}
                      name="code_of_conduct"
                      render={({ field }) => (
                        <FormItem>
                          <QuestionTitle label="SacHacks Code of Conduct" required />
                          <p className="gform-hint">
                            <a href={CODE_OF_CONDUCT_URL} target="_blank" rel="noopener noreferrer">
                              Read the Code of Conduct
                            </a>
                          </p>
                          <FormControl>
                            <div className="gform-options" role="group" aria-label="SacHacks Code of Conduct">
                              <label className={`gform-option${field.value ? " is-selected" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  onBlur={field.onBlur}
                                />
                                <span>I have read and agree to the SacHacks Code of Conduct.</span>
                              </label>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="gform-q">
                    <p className="gform-title">By typing your full name below, you agree to the following statements:</p>
                    <ul className="gform-list">
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
                    <TextQuestion control={control} name="signature" label="Full name (electronic signature)" required nested autoComplete="name" placeholder="Type your full name" />
                  </div>
                </>
              )}
            </div>

            <div className="gform-nav">
              {step > 0 && (
                <button type="button" className="gform-back" disabled={busy} onClick={() => goTo(step - 1)}>
                  Back
                </button>
              )}
              <Button type="submit" className="venom-submit" disabled={busy} {...submitTriggers}>
                {isLast ? (busy ? "Submitting..." : "Submit application") : "Next"}
              </Button>
            </div>
            <p className="venom-switch">
              <button type="button" onClick={() => navigate("/dashboard")}>Back to Hacker Hub</button>
            </p>
          </form>
        </Form>
      </section>
    </Layout>
  );
};

export default SignupPage;
