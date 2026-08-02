import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { BellIcon } from "lucide-react";

export default function TaskPreview() {
  const [searchParams] = useSearchParams();

  const createRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState<Date>();
  const [task, setTask] = useState<string>();
  const [time, setTime] = useState<string>();

  const [type, setType] = useState<string>();

  const [createImage, setCreateImage] = useState<string>();
  const [alertImage, setAlertImage] = useState<string>();

  useEffect(() => {
    const date = searchParams.get("date");
    const task = searchParams.get("task");
    const time = searchParams.get("time");
    const type = searchParams.get("type");

    if (!date || !task || !time || !type) return;
    const newDate = new Date(date);
    setDate(newDate);
    setTask(task);
    setTime(time);
    setType(type);
  }, [searchParams]);

  const getPng = async () => {
    if (type === "create") {
      if (!createRef.current) return;
      const createPng = await toPng(createRef.current);
      setCreateImage(createPng);
    } else if (type === "alert") {
      if (!alertRef.current) return;
      const alertPng = await toPng(alertRef.current);
      setAlertImage(alertPng);
    }
  };

  useEffect(() => {
    if (!createRef.current) return;
    getPng();
  }, [createRef, date, time, task]);

  return (
    date &&
    task &&
    time && (
      <div className="flex flex-wrap">
        <div>
          <div
            ref={createRef}
            className="relative flex w-fit gap-10 justify-between py-3 px-5 bg-gradient-to-br from-brand-from via-brand-via via-50% to-brand-to text-white rounded-lg"
          >
            <img
              className="absolute top-0 left-0 w-full h-full object-cover opacity-10 mix-blend-color-dodge"
              src="../topo_2.jpg"
              alt=""
            />

            <img
              className="absolute top-0 left-0 w-full h-full object-cover opacity-20 mix-blend-color-dodge invert"
              src="../halftone.jpg"
              alt=""
            />

            <div className="relative flex flex-col gap-3">
              <div className="flex gap-2 items-center font-bold text-2xl">
                {/* <CalendarCheckIcon size={28} /> */}
                <img src="../calendar_logo_6.png" alt="Calendar" className="w-9 aspect-square" />
                <span className="leading-none">Tarefa Criada</span>
              </div>

              <div className="flex flex-col font-medium text-lg">
                <span>{format(date, "PP")}</span>
                <span>{format(date, "p")}</span>
                <span>{task}</span>
              </div>
            </div>

            <div className="relative w-36 aspect-square">
              <img
                className="absolute w-full h-full object-contain -scale-x-100"
                src="../dailify_logo_2.png"
                alt="Dailify Logo"
              />
            </div>
          </div>

          <img src={createImage} id="create" alt="" />
        </div>

        <div>
          <div
            ref={alertRef}
            className="relative flex w-fit gap-10 justify-between py-3 px-5 bg-gradient-to-br from-brand-from via-brand-via via-50% to-brand-to text-white rounded-lg"
          >
            <img
              className="absolute top-0 left-0 w-full h-full object-cover opacity-10 mix-blend-color-dodge"
              src="../topo_2.jpg"
              alt=""
            />

            <img
              className="absolute top-0 left-0 w-full h-full object-cover opacity-20 mix-blend-color-dodge invert"
              src="../halftone.jpg"
              alt=""
            />

            <div className="relative flex flex-col gap-3">
              <div className="flex gap-2 items-start font-bold text-2xl">
                <div className="bg-white/30 rounded-md p-1.5">
                  <BellIcon />
                </div>
                <span className="leading-none">
                  Lembrete <br />
                  de Tarefa
                </span>
              </div>

              <div className="flex flex-col font-medium text-lg">
                <span>{format(date, "PP")}</span>
                <span>{format(date, "p")}</span>
                <span>{task}</span>
              </div>
            </div>

            <div className="relative w-36 aspect-square">
              <img
                className="absolute w-full h-full object-contain -scale-x-100"
                src="../dailify_logo_2.png"
                alt="Dailify Logo"
              />
            </div>
          </div>

          <img src={alertImage} id="alert" alt="" />
        </div>
      </div>
    )
  );
}
