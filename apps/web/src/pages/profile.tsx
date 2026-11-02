import { useClerk, useUser } from "@clerk/clerk-react";
import { FormDataValues } from "@/types/types";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/components/dashboard/copy";
import { DeleteAccount } from "@/components/delete-account";
import { CountryPicker, countries } from "@/components/country-picker";
import {
  SettingsGroup,
  SettingsRow,
  SettingsRowButton,
  settingsPage,
} from "@/components/settings-list";
import { Separator } from "@/components/ui/separator";
import { formFile, formString } from "@/lib/form";

import { PhoneNumberResource } from "@clerk/types";

import { Camera, ChevronRightIcon, Loader2Icon, LockIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { parsePhoneNumberWithError, PhoneNumber } from "libphonenumber-js";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

export default function ProfilePage(): JSX.Element {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [searchParams] = useSearchParams();

  const [isFileInvalid, setIsFileInvalid] = useState<boolean>(false);
  const [newProfilePicture, setNewProfilePicture] = useState<string>();
  const [hasImageChanged, setHasImageChanged] = useState<boolean>(false);
  const [phoneValue, setPhoneValue] = useState<string>("Brazil");
  const [phoneFromUrl, setPhoneFromUrl] = useState<PhoneNumber>();
  const [isVerifyingPhone, setIsVerifyingPhone] = useState<boolean>(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [code, setCode] = useState<string>();
  const [phoneObj, setPhoneObj] = useState<PhoneNumberResource>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
      alert(copy.profile.photoTooLarge);
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

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const chevron = <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />;
  const value = (text?: string | null) =>
    text ? (
      <span className="truncate text-sm text-content-secondary">{text}</span>
    ) : (
      <span className="text-xs text-muted-foreground">{copy.profile.empty}</span>
    );

  return (
    <main className={settingsPage}>
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.pageTitle}</h1>

      <Dialog>
        <div className="flex items-center gap-4 px-1">
          <Avatar className="size-14 rounded-xl">
            <AvatarImage src={user?.imageUrl} alt={fullName} />
            <AvatarFallback className="rounded-xl text-lg">
              {user?.firstName?.charAt(0)}
              {user?.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-medium">{fullName}</span>
            <span className="truncate text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              {copy.profile.editProfile}
            </Button>
          </DialogTrigger>
        </div>

        <SettingsGroup title={copy.profile.groupData}>
          <DialogTrigger asChild>
            <SettingsRowButton
              label={copy.profile.name}
              trailing={
                <>
                  {value(fullName)}
                  {chevron}
                </>
              }
            />
          </DialogTrigger>
          <DialogTrigger asChild>
            <SettingsRowButton
              label={copy.profile.username}
              trailing={
                <>
                  {value(user?.username && `@${user.username}`)}
                  {chevron}
                </>
              }
            />
          </DialogTrigger>
          <DialogTrigger asChild>
            <SettingsRowButton
              label={copy.profile.phone}
              trailing={
                <>
                  {value(user?.primaryPhoneNumber?.phoneNumber)}
                  {chevron}
                </>
              }
            />
          </DialogTrigger>
          <SettingsRow label={copy.profile.email} hint={copy.profile.emailLocked}>
            {value(user?.primaryEmailAddress?.emailAddress)}
            <LockIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </SettingsRow>
        </SettingsGroup>

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
                    className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-accent-primary text-primary-foreground shadow-sm hover:bg-accent-hover"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="sr-only">{copy.profile.photoChange}</span>
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
                  <p className="text-sm text-content-secondary">{copy.profile.photoHint}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{copy.profile.name}</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={user?.firstName || ""}
                      // onChange={handleInputChange}
                      placeholder={copy.profile.name}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="surname">{copy.profile.surname}</Label>
                    <Input
                      id="surname"
                      name="surname"
                      defaultValue={user?.lastName || ""}
                      // onChange={handleInputChange}
                      placeholder={copy.profile.surname}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="username">{copy.profile.username}</Label>
                    <Input
                      id="username"
                      name="username"
                      defaultValue={user?.username || ""}
                      // onChange={handleInputChange}
                      placeholder={copy.profile.username}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">{copy.profile.phone}</Label>

                    <div className="flex gap-1">
                      <CountryPicker value={phoneValue} onChange={setPhoneValue} />

                      <Input
                        id="phone"
                        name="phone"
                        defaultValue={user?.primaryPhoneNumber?.phoneNumber || ""}
                        // onChange={handleInputChange}
                        placeholder={copy.profile.phone}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">{copy.profile.email}</Label>
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

      <SettingsGroup title={copy.profile.groupAccount}>
        <SettingsRowButton
          label={copy.profile.signOut}
          onClick={() => void signOut({ redirectUrl: "/" })}
        />
        <DeleteAccount />
      </SettingsGroup>

      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.profile.phoneAddTitle}</DialogTitle>
            <DialogDescription>{copy.profile.phoneAddDescription}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex gap-1 w-full">
              <CountryPicker
                value={phoneValue}
                onChange={setPhoneValue}
                defaultValue={
                  countries.find((country) => country.code === phoneFromUrl?.country)?.name
                }
              />

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
            <DialogTitle>{copy.profile.phoneVerifyTitle}</DialogTitle>
            <DialogDescription>{copy.profile.phoneVerifyDescription}</DialogDescription>
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
                {copy.profile.close}
              </Button>
            </DialogClose>

            <Button onClick={handleCodeVerification} disabled={isLoading}>
              {isLoading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <>{copy.profile.phoneVerify}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
