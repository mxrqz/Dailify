export const priorityText = ["Not Important", "Low", "Medium", "High", "Very Important"]
export const priorityTextColor = ["text-gray-500", "text-green-500", "text-yellow-500", "text-orange-500", "text-red-500"]
export const priorityBorderColor = ["border-gray-500", "border-green-500", "border-yellow-500", "border-orange-500", "border-red-500"]
export const priorityBgColor = ["bg-gray-500/10", "bg-green-500/10", "bg-yellow-500/10", "bg-orange-500/10", "bg-red-500/10"]
export const prioritySelectedBgColor = ["data-[state=on]:bg-gray-500/70", "data-[state=on]:bg-green-500/70", "data-[state=on]:bg-yellow-500/70", "data-[state=on]:bg-orange-500/70", "data-[state=on]:bg-red-500/70"]
export const tagsBgColors2 = ["bg-[#eae4e9ff]", "bg-[#fff1e6ff]", "bg-[#fde2e4ff]", "bg-[#fad2e1ff]", "bg-[#e2ece9ff]", "bg-[#bee1e6ff]", "bg-[#f0efebff]", "bg-[#dfe7fdff]", "bg-[#cddafdff]"]
export const tagsBorderColors2 = ["border-[#eae4e9ff]", "border-[#fff1e6ff]", "border-[#fde2e4ff]", "border-[#fad2e1ff]", "border-[#e2ece9ff]", "border-[#bee1e6ff]", "border-[#f0efebff]", "border-[#dfe7fdff]", "border-[#cddafdff]"]

export const paletteColors = ["bg-[#ffadadff]", "bg-[#ffd6a5ff]", "bg-[#fdffb6ff]", "bg-[#caffbfff]", "bg-[#9bf6ffff]", "bg-[#a0c4ffff]", "bg-[#bdb2ffff]", "bg-[#ffc6ffff]", "bg-[#fffffcff]"]

export const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export const variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 1,
            staggerChildren: 0.1
        }
    }
}

export const childVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.1 } }
}

export const PLAN_ID = { free: "free", pro: "pro", proAi: "pro+ai" } as const;

export const planMap: Record<string, "Free" | "Pro" | "Pro + AI"> = {
    [PLAN_ID.free]: "Free",
    [PLAN_ID.pro]: "Pro",
    [PLAN_ID.proAi]: "Pro + AI",
};

export const serverURL = "https://dailify-server.onrender.com/"
export const dailifyURL = "https://dailify.mxrqz.com/"