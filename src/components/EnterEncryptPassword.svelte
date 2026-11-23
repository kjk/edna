<script lang="ts">
  import { getNotesCount } from "../notes";
  import PasswordDialog from "./PasswordDialog.svelte";

  interface Props {
    onclose: () => void;
    onpassword: (newName: string) => void;
  }
  let { onclose, onpassword }: Props = $props();
</script>

<PasswordDialog
  title="Enter password to encrypt files:"
  submitLabel="Encrypt {getNotesCount()} notes"
  note="Note: if you lose the password, you'll lose access to notes."
  {onclose}
  {onpassword}
/>
