import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkingHoursService } from "./workingHours.service";
import type { WorkingHoursRepository } from "./workingHours.repository";

// O service só repassa para o repository. O teste protege o contrato:
// os dias chegam inteiros ao repository e o retorno volta sem alteração.

const repository = {
  updateWorkingHours: vi.fn(),
};

const service = new WorkingHoursService(
  repository as unknown as WorkingHoursRepository,
);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("WorkingHoursService.updateWorkingHours", () => {
  it("repassa todos os dias ao repository e devolve o que ele retornou", async () => {
    const dias = [
      { day: 1, start_time: "08:00", end_time: "18:00", break_start: "12:00", break_end: "13:00", isOpen: true },
      { day: 0, start_time: "08:00", end_time: "12:00", isOpen: false },
    ];
    const gravados = dias.map((dia) => ({ id: `wh-${dia.day}`, dayOfWeek: dia.day }));
    repository.updateWorkingHours.mockResolvedValue(gravados);

    const resultado = await service.updateWorkingHours(dias);

    expect(resultado).toEqual(gravados);
    expect(repository.updateWorkingHours).toHaveBeenCalledWith(dias);
    expect(repository.updateWorkingHours).toHaveBeenCalledTimes(1);
  });
});
