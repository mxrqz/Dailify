import { useAuth, useUser, useSession } from "@clerk/clerk-react";
import {
  FormDataValues,
  InvoicesProps,
  PaymentDetailsProps,
  PermissionsProps,
} from "@/types/types";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useDailify } from "@/components/dailifyContext";
import { Progress } from "@/components/ui/progress";
import { planMap } from "@/consts/conts";
import { billingPortal } from "@/functions/api";
import { computeEntitlements } from "@dailify/shared";
import { FaCcVisa, FaCcAmex } from "react-icons/fa";
import { RiMastercardFill } from "react-icons/ri";
import ApplePayLogo from "@/components/ui/applePayLogo";
import GooglePayLogo from "@/components/ui/googlePayLogo";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "./ui/button";
import { copy } from "@/components/dashboard/copy";
import { Separator } from "./ui/separator";
import { CreditCard, Receipt } from "lucide-react";
import { Badge } from "./ui/badge";
import { formFile, formString } from "@/lib/form";

import { EllipsisVerticalIcon, Laptop2Icon, Smartphone } from "lucide-react";
import { PhoneNumberResource, SessionWithActivitiesResource } from "@clerk/types";
import { formatRelative } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

import {
  Camera,
  Check,
  Globe2Icon,
  LanguagesIcon,
  Loader2Icon,
  Mail,
  Phone,
  User,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberWithError,
  PhoneNumber,
} from "libphonenumber-js";
import * as countriesLib from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandGroup,
} from "../components/ui/command";
import { cn, toText } from "@/lib/utils";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "../components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import moment from "moment-timezone";
countriesLib.registerLocale(enLocale);
const countries = getCountries().map((code) => ({
  code,
  name: countriesLib.getName(code, "en") ?? code,
  dialCode: `+${getCountryCallingCode(code)}`,
}));

function getFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function SubscriptionTab({
  paymentDetails,
  permissions,
  invoices,
}: {
  paymentDetails: PaymentDetailsProps;
  permissions: PermissionsProps;
  invoices: InvoicesProps[];
}) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { tasks } = useDailify();
  const plan = planMap[toText(user?.publicMetadata.plan)];
  // Quota from the single entitlements source (counts distinct base tasks, not expanded instances).
  const tasksUsed = tasks ? new Set(tasks.map((t) => t.id)).size : 0;
  const entitlements = computeEntitlements(permissions, tasksUsed);

  const brandIcons: Record<string, JSX.Element> = {
    visa: <FaCcVisa className="text-foreground size-5" />,
    mastercard: <RiMastercardFill className="text-foreground size-5" />,
    amex: <FaCcAmex className="text-foreground size-5" />,
  };

  const walletIcons: Record<string, JSX.Element> = {
    apple_pay: <ApplePayLogo className="fill-foreground h-5" />,
    google_pay: <GooglePayLogo className="fill-foreground h-5" />,
  };

  const amountFormatted = (amount: number, currency: string) => {
    return (amount / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency,
    });
  };

  const getBillingPortalUrl = async () => {
    const token = await getToken();
    if (!token) return;

    const { url } = await billingPortal(token);
    if (url) window.location.href = url;
  };

  return (
    <Card className="rounded-2xl border-surface-line bg-surface-card">
      <CardHeader>
        <CardTitle>Plano e Assinatura</CardTitle>
        <CardDescription className="text-content-secondary">
          Gerencie seu plano atual e informações de pagamento.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Plano {plan}</h3>

              {paymentDetails && (
                <p className="text-sm text-content-secondary">
                  Próxima cobrança em {format(new Date(paymentDetails.start * 1000), "dd/MM/yyyy")}{" "}
                  • {amountFormatted(paymentDetails.amount, paymentDetails.currency)} /{" "}
                  {paymentDetails.recurring}
                </p>
              )}
            </div>

            <Button variant="outline" onClick={getBillingPortalUrl}>
              Gerenciar plano
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Tarefas utilizadas</span>

              <span className="font-medium">
                {entitlements.tasksUsed} /{" "}
                {entitlements.unlimited ? "ilimitado" : entitlements.monthlyLimit}
              </span>
            </div>

            <Progress
              value={
                entitlements.unlimited || entitlements.monthlyLimit <= 0
                  ? 0
                  : (entitlements.tasksUsed / entitlements.monthlyLimit) * 100
              }
              className="h-2"
            />

            <p className="text-xs text-muted-foreground">
              {entitlements.unlimited
                ? "Tarefas ilimitadas"
                : `${entitlements.remaining} tarefas restantes neste ciclo`}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Histórico de pagamentos</h3>

          <div className="space-y-4">
            {invoices
              ?.sort((a, b) => {
                return b.created - a.created;
              })
              .map((invoice, index) => (
                <div className="flex flex-col gap-1" key={index}>
                  <p className="text-sm text-content-secondary">
                    {format(new Date(invoice.created * 1000), "dd/MM/yyyy")} -{" "}
                    {amountFormatted(invoice.amount_paid, invoice.currency)}
                  </p>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle relative">
                        <CreditCard className="h-5 w-5 text-foreground" />
                      </div>

                      <div className="flex justify-center flex-col">
                        <div className="w-fit">
                          {walletIcons[toText(invoice?.walletType)] ?? null}
                        </div>

                        <div className="flex gap-2">
                          {brandIcons[toText(invoice?.brandName)]}

                          <p className="font-medium">••••</p>

                          <p className="font-medium">{invoice?.cardLast4}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {invoice.status === "paid" ? "Pago" : invoice.status}
                        </Badge>

                        <Link to={invoice.hosted_invoice_url ?? "#"}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Receipt className="h-4 w-4" />
                            <span className="sr-only">Ver fatura</span>
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityTab() {
  const { user } = useUser();
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[]>();

  const getSessions = async () => {
    const sessions = await user?.getSessions();
    if (sessions) setSessions(sessions);
  };

  useEffect(() => {
    getSessions();
  }, []);

  return (
    <Card className="rounded-2xl border-surface-line bg-surface-card">
      <CardHeader>
        <CardTitle>Segurança da Conta</CardTitle>
        <CardDescription className="text-content-secondary">
          Gerencie as configurações de segurança da sua conta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-base font-medium">Senha</h4>
            </div>

            <Button disabled>Alterar senha</Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-base font-medium">Sessões ativas</h4>
            <p className="text-sm text-content-secondary">
              Dispositivos atualmente conectados à sua conta.
            </p>

            <div className="space-y-4">
              {sessions &&
                sessions
                  .slice(0, 3)
                  .sort((a, b) => {
                    const dateA = a.lastActiveAt.getTime();
                    const dateB = b.lastActiveAt.getTime();
                    return dateB - dateA;
                  })
                  .map((session) => (
                    <div key={session.id} className="grid grid-cols-[25%_45%_25%_5%] items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle">
                          {session.latestActivity.isMobile ? (
                            <Smartphone className="h-5 w-5 text-foreground" />
                          ) : (
                            <Laptop2Icon className="h-5 w-5 text-foreground" />
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <p className="font-medium">{session.latestActivity.deviceType}</p>

                            <div className="flex items-center gap-2">
                              {session.id === currentSession?.id && (
                                <Badge
                                  variant="outline"
                                  className="border-success text-2xs py-0.5 px-1"
                                >
                                  Atual
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {session.latestActivity.browserName}{" "}
                            {session.latestActivity.browserVersion}
                          </p>
                        </div>
                      </div>

                      <span className="text-sm text-content-secondary">
                        {session.latestActivity.ipAddress} ({session.latestActivity.city},{" "}
                        {session.latestActivity.country})
                      </span>

                      <span className="text-sm text-content-secondary">
                        {formatRelative(session.lastActiveAt, new Date())}
                      </span>

                      <Popover>
                        <PopoverTrigger className="justify-self-end cursor-pointer" asChild>
                          <Button size={"icon"} variant={"ghost"}>
                            <EllipsisVerticalIcon />
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent align="end" className="p-1">
                          <Button
                            variant="ghost"
                            className="h-7 w-full justify-start px-2 py-0 text-start text-destructive hover:text-destructive"
                            onClick={() => session.revoke()}
                          >
                            {copy.profile.revokeDevice}
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
            </div>

            <Button variant="outline" size="sm">
              Ver todos os dispositivos
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonalTab() {
  const { user, isLoaded } = useUser();
  const [searchParams] = useSearchParams();

  const [isFileInvalid, setIsFileInvalid] = useState<boolean>(false);
  const [newProfilePicture, setNewProfilePicture] = useState<string>();
  const [timezoneOpen, setTimezoneOpen] = useState<boolean>(false);
  const [hasImageChanged, setHasImageChanged] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [phoneValue, setPhoneValue] = useState<string>("Brazil");
  const [phoneFromUrl, setPhoneFromUrl] = useState<PhoneNumber>();
  const [isVerifyingPhone, setIsVerifyingPhone] = useState<boolean>(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [code, setCode] = useState<string>();
  const [timezone, setTimezone] = useState<string>(() => toText(user?.unsafeMetadata.timezone));
  const [language, setLanguage] = useState<string>(() =>
    toText(user?.unsafeMetadata.language, "en"),
  );
  const [phoneObj, setPhoneObj] = useState<PhoneNumberResource>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const timezonesNames = moment.tz.names();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileInput = async (file: File) => {
    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("O arquivo deve ter no máximo 2MB.");
      setIsFileInvalid(true);
      return;
    }

    const string = await fileToBase64(file);
    setNewProfilePicture(string);
    setHasImageChanged(true);
    setIsFileInvalid(false);
  };

  const handleCodeVerification = async () => {
    setIsLoading(true);
    if (!code) return;
    const phoneVerifyAttempt = await phoneObj?.attemptVerification({ code });

    if (phoneVerifyAttempt?.verification.status === "verified") {
      await user?.update({ primaryPhoneNumberId: phoneObj?.id });
      await user?.reload();
      // setSuccess(true)
    } else {
      // setFailed(true)
    }

    setIsVerifyingPhone(false);
    setIsLoading(false);
  };

  const timezones = timezonesNames.map((timezone) => {
    const offset = moment.tz(timezone).format("Z");
    return {
      timezone,
      offset,
    };
  });

  const updateProfile = async (data: FormDataValues) => {
    if (!user || !isLoaded) return;
    const { firstName, lastName, username } = data;

    await user?.update({
      firstName: firstName,
      lastName: lastName,
      username: username,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const firstName = formString(formData, "name");
    const lastName = formString(formData, "surname");
    const username = formString(formData, "username");
    const phone = formString(formData, "phone");
    const phoneNumber = `${countries.find((country) => country.name === phoneValue)?.dialCode?.replace("+", "")}${phone}`;
    const file = formFile(formData, "avatar");

    if (
      (firstName !== null || lastName !== null || username !== null) &&
      (user?.firstName !== firstName || user.lastName !== lastName || user.username !== username)
    ) {
      await updateProfile({ firstName, lastName, username });
    }

    if (user?.primaryPhoneNumber?.phoneNumber !== phoneNumber) {
      setIsLoading(true);
      const createPhone = await user?.createPhoneNumber({ phoneNumber });
      user?.primaryPhoneNumber?.create();
      createPhone?.prepareVerification();
      setPhoneObj(createPhone);
      setIsVerifyingPhone(true);
      setIsLoading(false);
      setPhoneDialogOpen(false);
      await user?.reload();
    }

    if (user?.publicMetadata.timeZone !== timezone) {
      user?.update({
        unsafeMetadata: {
          timezone: timezone,
        },
      });
    }

    if (user?.publicMetadata.language !== language) {
      user?.update({
        unsafeMetadata: {
          language: language,
        },
      });
    }

    if (file && !isFileInvalid && hasImageChanged) {
      setHasImageChanged(false);
      await user?.setProfileImage({ file });
    }
  };

  useEffect(() => {
    const phoneFromUrl = searchParams.get("addPhone");
    if (!phoneFromUrl) return;

    const original = parsePhoneNumberWithError(`+${phoneFromUrl}`);
    const countryInfo = countries.find((c) => c.code === original.country);

    if (countryInfo) setPhoneValue(countryInfo.name);

    const national = original.nationalNumber;

    const correctedNumber =
      original.country === "BR" && national.length === 10 && !national.startsWith("9")
        ? `+${original.countryCallingCode}${national.slice(0, 2)}9${national.slice(2)}`
        : original.number;

    const parsed = parsePhoneNumberWithError(correctedNumber);
    setPhoneFromUrl(parsed);
    setPhoneDialogOpen(true);
  }, [searchParams]);

  return (
    <>
      <Card className="rounded-2xl border-surface-line bg-surface-card">
        <CardHeader>
          <CardTitle>{copy.profile.personalTitle}</CardTitle>
          <CardDescription className="text-content-secondary">
            {copy.profile.personalDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user?.imageUrl} alt={user?.firstName || ""} />
                <AvatarFallback className="text-2xl">
                  {user?.firstName?.charAt(0)}
                  {user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-xl font-semibold">
                {user?.firstName} {user?.lastName}
              </h3>
              <p className="text-sm text-content-secondary">@{user?.username}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.firstName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="surname">Surname</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.lastName}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                  <span className="text-muted-foreground">@</span>
                  <span>{user?.username}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.primaryPhoneNumber?.phoneNumber || "Uninformed"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeZone">Time Zone</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                  <Globe2Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{timezone}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                  <LanguagesIcon className="h-4 w-4 text-muted-foreground" />
                  <span>English</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">The email cannot be changed.</p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Dialog>
            <DialogTrigger asChild>
              <Button>{copy.profile.editProfile}</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[calc(100%-2rem)] overflow-y-scroll scrollbar-floating">
              <DialogHeader className="">
                <DialogTitle>{copy.profile.editTitle}</DialogTitle>
                <DialogDescription>{copy.profile.editDescription}</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit}>
                <div className="grid gap-6 py-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage
                          src={newProfilePicture || user?.imageUrl}
                          alt={`${user?.firstName} profile picture`}
                        />
                        <AvatarFallback className="text-2xl">
                          {user?.firstName?.slice(0, 1)}
                          {user?.lastName?.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>

                      <Label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent-primary text-primary-foreground shadow-sm hover:bg-accent-hover"
                      >
                        <Camera className="h-4 w-4" />
                        <span className="sr-only">Change Profile Picture</span>
                      </Label>

                      <Input
                        id="avatar-upload"
                        name="avatar"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileInput(e.currentTarget.files![0])}
                      />
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-content-secondary">
                        Click on the camera to change your profile picture
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          name="name"
                          defaultValue={user?.firstName || ""}
                          // onChange={handleInputChange}
                          placeholder="Your name"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="surname">Surname</Label>
                        <Input
                          id="surname"
                          name="surname"
                          defaultValue={user?.lastName || ""}
                          // onChange={handleInputChange}
                          placeholder="Your surname"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          name="username"
                          defaultValue={user?.username || ""}
                          // onChange={handleInputChange}
                          placeholder="Your username"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="username">Phone</Label>

                        <div className="flex gap-1">
                          <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-fit p-0 px-2"
                              >
                                {phoneValue
                                  ? countries.find((country) => country.name === phoneValue)
                                      ?.dialCode
                                  : "+55"}
                              </Button>
                            </PopoverTrigger>

                            <PopoverContent>
                              <Command defaultValue={phoneValue}>
                                <CommandInput />

                                <CommandList className="scroll-py-0">
                                  <CommandEmpty>Country not found</CommandEmpty>

                                  <CommandGroup>
                                    {countries
                                      .sort((a, b) => {
                                        const codeA = parseInt(a.dialCode.replace("+", ""));
                                        const codeB = parseInt(b.dialCode.replace("+", ""));
                                        return codeA - codeB;
                                      })
                                      .map((country, index) => (
                                        <CommandItem
                                          key={index}
                                          className="flex gap-2"
                                          value={country.name}
                                          onSelect={(currentValue) => {
                                            setPhoneValue(
                                              currentValue === phoneValue ? "" : currentValue,
                                            );
                                            setOpen(false);
                                          }}
                                        >
                                          <span>{getFlagEmoji(country.code)}</span>
                                          <span className="text-muted-foreground">
                                            {country.dialCode}
                                          </span>
                                          <span>{country.name}</span>
                                          <Check
                                            className={cn(
                                              "ml-auto",
                                              phoneValue === country.code
                                                ? "opacity-100"
                                                : "opacity-0",
                                            )}
                                          />
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          <Input
                            id="phone"
                            name="phone"
                            defaultValue={user?.primaryPhoneNumber?.phoneNumber || ""}
                            // onChange={handleInputChange}
                            placeholder="Your Phone Number"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2 w-full">
                        <Label htmlFor="timezone">Time Zone</Label>

                        <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={timezoneOpen}
                              className="w-full bg-background dark:bg-background justify-start"
                            >
                              {timezone ? timezone : "Select your timezone"}
                            </Button>
                          </PopoverTrigger>

                          <PopoverContent>
                            <Command defaultValue={timezone}>
                              <CommandInput />

                              <CommandList className="scroll-py-0">
                                <CommandEmpty>TimeZone not found</CommandEmpty>

                                <CommandGroup>
                                  {timezones
                                    .sort((a, b) => {
                                      const codeA = parseInt(a.offset);
                                      const codeB = parseInt(b.offset);
                                      return codeA - codeB;
                                    })
                                    .map((tz, index) => (
                                      <CommandItem
                                        key={index}
                                        className="flex gap-2"
                                        value={tz.timezone}
                                        onSelect={(currentValue) => {
                                          setTimezone(
                                            currentValue === timezone ? "" : currentValue,
                                          );
                                          setTimezoneOpen(false);
                                        }}
                                      >
                                        <span>{tz.timezone}</span>
                                        <span>{tz.offset}</span>
                                        <Check
                                          className={cn(
                                            "ml-auto",
                                            timezone === tz.timezone ? "opacity-100" : "opacity-0",
                                          )}
                                        />
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="language">Language</Label>

                        <div className="flex gap-1">
                          <Select
                            defaultValue={language}
                            value={language}
                            onValueChange={(value) => setLanguage(value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select your language" />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="pt">Português</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={user?.primaryEmailAddress?.emailAddress}
                        disabled
                        className="bg-muted/50 text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground">{copy.profile.emailLocked}</p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="cursor-pointer">
                      {copy.form.cancel}
                    </Button>
                  </DialogClose>

                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2Icon className="animate-spin" />
                        <span>{copy.profile.saving}</span>
                      </>
                    ) : (
                      copy.form.save
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Your Phone Number</DialogTitle>
            <DialogDescription>
              Confirm or edit the phone number you'd like to add to your profile.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex gap-1 w-full">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-fit p-0 px-2"
                  >
                    {phoneValue
                      ? countries.find((country) => country.name === phoneValue)?.dialCode
                      : "+55"}
                  </Button>
                </PopoverTrigger>

                <PopoverContent>
                  <Command
                    defaultValue={
                      countries.find((country) => country.code === phoneFromUrl?.country)?.name
                    }
                  >
                    <CommandInput />

                    <CommandList className="scroll-py-0">
                      <CommandEmpty>Country not found</CommandEmpty>

                      <CommandGroup>
                        {countries
                          .sort((a, b) => {
                            const codeA = parseInt(a.dialCode.replace("+", ""));
                            const codeB = parseInt(b.dialCode.replace("+", ""));
                            return codeA - codeB;
                          })
                          .map((country, index) => (
                            <CommandItem
                              key={index}
                              className="flex gap-2"
                              value={country.name}
                              onSelect={(currentValue) => {
                                setPhoneValue(currentValue === phoneValue ? "" : currentValue);
                                setOpen(false);
                              }}
                            >
                              <span>{getFlagEmoji(country.code)}</span>
                              <span className="text-muted-foreground">{country.dialCode}</span>
                              <span>{country.name}</span>
                              <Check
                                className={cn(
                                  "ml-auto",
                                  phoneValue === country.code ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={phoneFromUrl?.nationalNumber || ""}
                // onChange={handleInputChange}
                placeholder="Your Phone Number"
              />
            </div>

            <DialogFooter>
              <DialogClose>
                <Button variant={"ghost"} type="button">
                  {copy.form.cancel}
                </Button>
              </DialogClose>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <>{copy.profile.addPhone}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerifyingPhone} onOpenChange={setIsVerifyingPhone}>
        <DialogContent className="flex flex-col gap-5 items-center justify-center z-50">
          <DialogHeader>
            <DialogTitle>Verify Your Phone Number</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code we sent to your phone to complete the verification.
            </DialogDescription>
          </DialogHeader>

          <InputOTP maxLength={6} onChange={setCode} pattern={REGEXP_ONLY_DIGITS}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          <DialogFooter className="self-end">
            <DialogClose>
              <Button variant={"outline"} onClick={() => setIsVerifyingPhone(false)}>
                Close
              </Button>
            </DialogClose>

            <Button onClick={handleCodeVerification} disabled={isLoading}>
              {isLoading ? <Loader2Icon className="animate-spin" /> : <>Verify</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
