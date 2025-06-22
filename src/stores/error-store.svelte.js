class ErrorStore {
  errors = $state([]);

  setErrors(errors) {
    this.errors = errors;
  }

  addError(error) {
    this.errors.push(error);
  }

  popError() {
    this.errors.splice(0, 1);
  }
}

let errorStore = new ErrorStore();

export function useErrorStore() {
  return errorStore;
}
