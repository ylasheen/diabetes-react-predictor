// rbf.js — RBF Neural Network inference (mirrors Python exactly)

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function standardize(input, mean, std) {
  return input.map((v, i) => (v - mean[i]) / std[i]);
}

export function rbfActivations(x, centers, sigma) {
  return centers.map(center => {
    const distSq = x.reduce((sum, xi, i) => sum + (xi - center[i]) ** 2, 0);
    return Math.exp(-distSq / (2 * sigma ** 2));
  });
}

export function logisticOutput(h, coef, intercept) {
  const logit = h.reduce((sum, hi, i) => sum + hi * coef[0][i], 0) + intercept[0];
  return sigmoid(logit);
}

export function predict(rawInput, model) {
  const { centers, sigma, threshold, lr_coef, lr_intercept, scaler_mean, scaler_std } = model;
  const scaled = standardize(rawInput, scaler_mean, scaler_std);
  const h      = rbfActivations(scaled, centers, sigma);
  const prob   = logisticOutput(h, lr_coef, lr_intercept);
  return {
    probability: prob,
    prediction:  prob >= threshold ? 1 : 0,
    probNo:      1 - prob,
  };
}
