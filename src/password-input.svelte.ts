import { len } from "./util";

// state and keyboard handling shared by password entry dialogs
export class PasswordInput {
  password = $state("");
  hidePassword = $state(true);
  valid = $derived(len(this.password.trim()) >= 8);
  error = $derived(this.valid ? "" : "password must be at least 8 characters long");

  private onpassword: (password: string) => void;

  constructor(onpassword: (password: string) => void) {
    this.onpassword = onpassword;
  }

  submit() {
    this.onpassword(this.password);
  }

  // Enter submits a valid password and is always swallowed
  onkeydown = (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      if (this.valid) {
        this.submit();
      }
      ev.preventDefault();
      ev.stopPropagation();
    }
  };
}
