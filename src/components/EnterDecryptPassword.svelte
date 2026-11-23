<script lang="ts">
  import PasswordDialog from "./PasswordDialog.svelte";

  interface Props {
    msg: string;
    onpassword: (newName: string) => void;
  }
  let { msg, onpassword }: Props = $props();
</script>

<PasswordDialog title="Enter password to decrypt files:" submitLabel="Ok" {msg} {onpassword} />
