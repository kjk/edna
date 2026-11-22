<script lang="ts">
  import EnterDecryptPassword from "./EnterDecryptPassword.svelte";
  import Overlay from "./Overlay.svelte";

  // Password dialog that can be shown without App (e.g. while booting from
  // the permissions screen). See getPasswordFromUser() in globals.ts.
  interface Props {
    msg: string;
    onpassword: (pwd: string) => void;
    onclose: () => void;
  }
  let { msg, onpassword, onclose }: Props = $props();
</script>

<Overlay {onclose} blur={true}>
  <EnterDecryptPassword {msg} {onpassword}></EnterDecryptPassword>
</Overlay>
