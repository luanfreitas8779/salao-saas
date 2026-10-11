import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    status: 429,
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const recoveryPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    status: 429,
    error:
      "Muitas tentativas de recuperar senha. Tente novamente em 1 (uma) hora!",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
