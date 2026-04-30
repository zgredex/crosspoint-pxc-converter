export type ControllerHost = {
  clearStatus: () => void;
  showError: (message: string) => void;
  clearHistogramView: () => void;
  resetSession: () => void;
};
