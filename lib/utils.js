export function method(validatedMethod) {
  function f(...args) {
    return validatedMethod.call(...args);
  }

  f.validatedMethod = validatedMethod;

  return f;
}

export function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i += 1) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
