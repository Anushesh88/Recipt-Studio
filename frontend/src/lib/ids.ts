export const generateId = (prefix: string = "el_") => {
  return `${prefix}${Math.random().toString(36).substr(2, 6)}`;
};
