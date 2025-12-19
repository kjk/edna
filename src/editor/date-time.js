export const insertDateAndTime = ({ state, dispatch }) => {
  if (state.readOnly) {
    return false;
  }

  const dateText = new Date().toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  dispatch(state.replaceSelection(dateText), {
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
};

export const insertTime = ({ state, dispatch }) => {
  if (state.readOnly) {
    return false;
  }

  let now = new Date();
  // get time in 24-hour format
  // Format as 24-hour time string HH:MM
  const s = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    //seconds: "2-digit",
    hour12: false, // Ensures 24-hour format
  });
  dispatch(state.replaceSelection(s), {
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
};
