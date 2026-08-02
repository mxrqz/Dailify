import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Input } from "./ui/input";
import { Camera, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { FormDataValues } from "@/types/types";

export default function ProfileConfig() {
  const { user, isLoaded } = useUser();
  const [isFileInvalid, setIsFileInvalid] = useState<boolean>(false);
  const [hasImageChanged, setHasImageChanged] = useState<boolean>(false);
  const [newProfilePicture, setNewProfilePicture] = useState<string>();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const firstName = formData.get("name") as string;
    const lastName = formData.get("surname") as string;
    const username = formData.get("username") as string;
    const file = (formData.get("avatar") as File) || null;
    // const imageUrl = file ? await fileToBase64(file) : undefined

    if (user?.firstName !== firstName || user.lastName !== lastName || user.username !== username) {
      await updateProfile({ firstName, lastName, username });
    }

    if (file && !isFileInvalid && hasImageChanged) {
      setHasImageChanged(false);
      await user?.setProfileImage({ file });
    }
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

  return (
    <Dialog>
      <DialogTrigger className="focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive-foreground data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/40 data-[variant=destructive]:focus:text-destructive-foreground data-[variant=destructive]:*:[svg]:!text-destructive-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full hover:bg-accent">
        <UserIcon />
        <span>Profile</span>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100%-2rem)] overflow-y-scroll">
        <DialogHeader className="">
          <DialogTitle>User Profile</DialogTitle>
          <DialogDescription>
            Update your profile information. Click save when you're done.
          </DialogDescription>
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
                  className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
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
                <p className="text-sm text-muted-foreground">
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.primaryEmailAddress?.emailAddress}
                  disabled
                  className="bg-muted/50 text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Email can't be changed.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="cursor-pointer">
                Cancel
              </Button>
            </DialogClose>

            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
