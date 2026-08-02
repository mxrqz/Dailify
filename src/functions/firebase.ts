import { TaskProps } from "@/types/types";
import { initializeApp } from "firebase/app";
import { collection, deleteDoc, doc, getDocs, getFirestore, query, Timestamp, where } from "firebase/firestore";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isSameYear } from "date-fns";
import { getAuth} from "firebase/auth";
import { serverURL } from "@/consts/conts";

const firebaseConfig = {
    apiKey: "AIzaSyBjb63TKK_8X-FLpTMNrogEyTn_LZbyLX0",
    authDomain: "dailify-64dd2.firebaseapp.com",
    projectId: "dailify-64dd2",
    storageBucket: "dailify-64dd2.firebasestorage.app",
    messagingSenderId: "603576549979",
    appId: "1:603576549979:web:3c302869d9432cc034b57e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app)

export { auth, db }

export async function saveTask(taskData: TaskProps, token: string): Promise<{ error?: string }> {
    const response = await fetch(`${serverURL}createTask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
    })

    const data = await response.json()
    if (data.error) {
        return { error: data.error }
    }

    return {}
}

export async function createTaskVoice(token: string, formData: FormData) {
    const response = await fetch(`${serverURL}createTaskByVoice`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    })

    return response
}

// export async function saveTask(userId: string, taskData: TaskProps) {
// await setDoc(doc(db, "users", userId, "tasks", taskData.id), taskData);

//     if (taskData.repeat !== "Off" && typeof taskData.repeat === "string") {
//         const taskRef = doc(db, "users", userId, "repeatTasks", taskData.repeat);
//         const taskSnap = await getDoc(taskRef);

//         if (taskSnap.exists()) {
//             await updateDoc(taskRef, {
//                 id: arrayUnion(taskData.id)
//             });
//         } else {
//             await setDoc(taskRef, {
//                 id: [taskData.id]
//             });
//         }
//     } else if (typeof taskData.repeat === 'object') {
//         const repeatValues = Object.values(taskData.repeat)[0]

//         repeatValues?.forEach(async day => {
//             const taskRef = doc(db, "users", userId, "repeatTasks", day)
//             const taskSnap = await getDoc(taskRef)

//             if (taskSnap.exists()) {
//                 await updateDoc(taskRef, {
//                     id: arrayUnion(taskData.id)
//                 })
//             } else {
//                 await setDoc(taskRef, {
//                     id: [taskData.id]
//                 });
//             }
//         })
//     }
// }

export async function saveEditedTask(taskData: TaskProps, token: string): Promise<{ error?: string }> {
    // const docToUpdate = doc(db, "users", userId, "tasks", taskData.id);
    // updateDoc(docToUpdate, { ...taskData })

    const response = await fetch(`${serverURL}editTask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
    })

    const data = await response.json()
    if (data.error) {
        return { error: data.error }
    }

    return {}
}

export async function markTaskAsCompleted(token: string, taskId: string) {
    // const docToUpdate = doc(db, "users", userId, "tasks", taskId);
    // updateDoc(docToUpdate, {
    //     completed: arrayUnion(now)
    // });

    const response = await fetch(`${serverURL}editCompletedTask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ taskId: taskId })
    })

    const data = await response.json()
    if (data.error) {
        return { error: data.error }
    }

    return {}
}

export async function deleteTask(userId: string, taskId: string) {
    const docToDelete = doc(db, "users", userId, "tasks", taskId);
    await deleteDoc(docToDelete);
}

export async function getTasksForMonth(userId: string, month: Date) {
    const tasks = await getMonthTasks(userId, month)
    const repeatTasks = await getMonthlyRepeatTasks(userId, month)

    if (repeatTasks) {
        const uniqueTasks = Array.from(
            new Map(
                [...tasks, ...repeatTasks]
                    .filter((task): task is TaskProps =>
                        task !== null && task !== undefined && task.id !== null && task.id !== undefined && task.date !== undefined
                    )
                    .map(task => [`${task.id}-${task.date}`, task])
            ).values()
        );

        return uniqueTasks
    }


    return tasks
}

async function getMonthTasks(userId: string, month: Date) {
    const start = startOfMonth(month);
    const end = endOfMonth(month);

    const q = query(collection(db, "users", userId, "tasks"),
        where("date", ">=", start),
        where("date", "<=", end)
    );

    let tasks: TaskProps[] = []

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        tasks.push(doc.data() as TaskProps)
    })

    return tasks
}

async function getMonthlyRepeatTasks(userId: string, month: Date) {
    const repeatTasksDocRef = collection(db, "users", userId, "repeatTasks");
    const repeatTasksDocs = await getDocs(repeatTasksDocRef);

    const taskIdSet = new Set<string>();

    repeatTasksDocs.forEach(doc => {
        if (!doc.exists()) return;

        const ids: string[] = doc.data().id;
        ids.forEach(id => taskIdSet.add(id));
    });

    const taskIds = Array.from(taskIdSet);

    return getMonthTaskByIds(userId, taskIds, month);
}

export async function getMonthTaskByIds(userId: string, taskId: string[], month: Date): Promise<TaskProps[] | null> {
    if (taskId.length === 0) return null;

    const start = startOfMonth(month)
    const end = endOfMonth(month);

    let tasks: TaskProps[] = [];

    // Firestore 'in' allows up to 30 values — chunk the ids instead of reading the whole collection
    const docs: TaskProps[] = [];
    for (let i = 0; i < taskId.length; i += 30) {
        const chunk = taskId.slice(i, i + 30);
        const q = query(collection(db, "users", userId, "tasks"), where("id", "in", chunk));
        const snap = await getDocs(q);
        snap.forEach(d => docs.push(d.data() as TaskProps));
    }

    docs.forEach(data => {

        if (typeof data.repeat === "string") {
            const originalDate = (data.date as Timestamp).toDate();

            switch (data.repeat) {
                case "Off":
                    break;

                case "Daily":
                    const newData = Array.from({ length: end.getDate() }).map((_, index) => {
                        const newDate = Timestamp.fromDate(new Date((data.date as Timestamp).toDate().setDate(index + 1)))

                        const newData = {
                            ...data,
                            date: newDate
                        }

                        return newData
                    })

                    newData.forEach(task => tasks.push(task))
                    break;

                case "Monthly":
                    if (isSameMonth(originalDate, month)) return;

                    const updatedMonthlyDate = new Date(originalDate);
                    updatedMonthlyDate.setMonth(month.getMonth());

                    const task: TaskProps = {
                        ...data,
                        date: Timestamp.fromDate(updatedMonthlyDate),
                    };

                    tasks.push(task);
                    break;

                case "Yearly":
                    if (isSameYear(originalDate, month)) return;
                    const year = month.getFullYear()

                    const updatedYearDate = new Date(originalDate);
                    updatedYearDate.setFullYear(year);

                    const yearlyTask: TaskProps = {
                        ...data,
                        date: Timestamp.fromDate(updatedYearDate),
                    };

                    tasks.push(yearlyTask);
                    break;
            }
        } else if (typeof data.repeat === "object" && Object.keys(data.repeat)[0] === 'Weekly') {
            // pegar todos os dias do mes selecionado
            const days = eachDayOfInterval({ start, end })

            // verficar qual o dia da semana
            days.forEach(day => {
                // adicionar a tarefa com o dia da semana igual ao dia
                const newDate = Timestamp.fromDate(new Date((data.date as Timestamp).toDate().setDate(day.getDate())))

                const weekDay = format(day, "EEEE")
                const repeatDays: string[] = Object.values(data.repeat)[0]
                if (repeatDays.includes(weekDay)) {
                    const newData = {
                        ...data,
                        date: newDate
                    }
                    tasks.push(newData)
                }
            })
        }

        // if (typeof data.repeat === "string" && data.repeat === "Daily") {
        //     const newData = Array.from({ length: end.getDate() }).map((_, index) => {
        //         const newDate = Timestamp.fromDate(new Date((data.date as Timestamp).toDate().setDate(index + 1)))

        //         const newData = {
        //             ...data,
        //             date: newDate
        //         }

        //         return newData
        //     })

        //     newData.forEach(task => tasks.push(task))
        // }


        // else if (typeof data.repeat === "string" && data.repeat === "Monthly") {
        //     const selecteDay = month.getDate()
        //     const taskDate = data.date instanceof Timestamp && data.date.toDate().getDate()
        //     if (selecteDay === taskDate) {
        //         tasks.push(data)
        //     }
        // }
    });

    return tasks;
}
