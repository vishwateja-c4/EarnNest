import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"

interface Task {
    id: string
    title: string
    description: string
    category: string
    budget: number
    deadline: string
    required_skills: string[]
    priority_level: string
    profiles?: { full_name: string }
}

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    recommendedTasks?: Task[]
}

interface TaskRecommenderProps {
    tasks: Task[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TaskRecommender({ tasks, open, onOpenChange }: TaskRecommenderProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        if (open && messages.length === 0) {
            const initialMsg: Message = {
                id: "1",
                role: "assistant",
                content: "Hello! 👋 I'm your task recommendation assistant. Tell me what kind of work you're looking for, your budget, skills, or any specific preferences, and I'll recommend the best tasks for you from our available listings.",
            }
            setMessages([initialMsg])
        }
    }, [open])

    const getRecommendations = async (userMessage: string) => {
        try {
            setLoading(true)

            // Build conversation history for context
            const conversationHistory = messages
                .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
                .join("\n")

            const fullContext = conversationHistory ? `${conversationHistory}\nUser: ${userMessage}` : userMessage

            // Prepare tasks list for AI context
            const tasksContext = tasks
                .map(
                    (t) =>
                        `Task ID: ${t.id}, Title: "${t.title}", Category: ${t.category}, Budget: ₹${t.budget}, Skills: ${t.required_skills.join(", ")}, Priority: ${t.priority_level}, Deadline: ${new Date(t.deadline).toLocaleDateString()}`
                )
                .join("\n")

            const prompt = `You are a helpful task recommendation assistant. Analyze the user's requirements and recommend the most suitable tasks from the available list.

Available Tasks:
${tasksContext}

Conversation:
${fullContext}

Based on the user's message and conversation history, provide:
1. A brief analysis of their requirements
2. Recommended task IDs that match their needs (format: Task ID: xxx)
3. Reasons why these tasks are suitable
4. Any relevant tips

Format your response clearly with the recommended task IDs explicitly mentioned so they can be parsed.`

            const apiKey = import.meta.env.VITE_OPENAI_API_KEY
            if (!apiKey) {
                throw new Error("OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env.local")
            }

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful task recommendation assistant. Analyze the user's requirements and recommend the most suitable tasks from the available list.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error?.message || "Failed to get recommendations")
            }

            const data = await response.json()
            const aiResponse =
                data.choices?.[0]?.message?.content ||
                "I couldn't generate a response. Please try again."

            // Parse task IDs from response
            const taskIdRegex = /Task ID:\s*([a-f0-9-]+)/gi
            const matchedIds = new Set<string>()
            let match

            while ((match = taskIdRegex.exec(aiResponse)) !== null) {
                matchedIds.add(match[1])
            }

            const recommendedTasks = tasks.filter((t) => matchedIds.has(t.id)).slice(0, 5) // Limit to 5

            // Add user message
            const userMsg: Message = {
                id: Date.now().toString(),
                role: "user",
                content: userMessage,
            }
            setMessages((prev) => [...prev, userMsg])

            // Add AI response
            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: aiResponse,
                recommendedTasks: recommendedTasks,
            }
            setMessages((prev) => [...prev, assistantMsg])
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error ? err.message : "An error occurred while getting recommendations"
            const errorMessage: Message = {
                id: Date.now().toString(),
                role: "assistant",
                content: `Error: ${errorMsg}`,
            }
            setMessages((prev) => [...prev, errorMessage])
        } finally {
            setLoading(false)
        }
    }

    const handleSend = async () => {
        if (!input.trim()) return

        await getRecommendations(input)
        setInput("")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Find Your Perfect Task 🎯</DialogTitle>
                    <DialogDescription>
                        Tell me what you're looking for and I'll recommend the best tasks for you
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                {/* Display recommended tasks */}
                                {msg.recommendedTasks && msg.recommendedTasks.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-xs font-semibold text-foreground">📌 Recommended Tasks:</p>
                                        {msg.recommendedTasks.map((task) => (
                                            <Link key={task.id} to={`/tasks/${task.id}`}>
                                                <Card className="p-2 text-xs hover:bg-primary/10 transition-colors cursor-pointer">
                                                    <p className="font-medium text-foreground">{task.title}</p>
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        <Badge variant="secondary" className="text-xs h-5">
                                            ₹{task.budget}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs h-5 capitalize">
                                            {task.priority_level}
                                        </Badge>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="flex gap-2 border-t pt-4">
                    <Input
                        placeholder="Describe what you're looking for..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === "Enter" && !loading) {
                                handleSend()
                            }
                        }}
                        disabled={loading}
                        className="glassy-input"
                    />
                    <Button onClick={handleSend} disabled={loading || !input.trim()}>
                        {loading ? "..." : "Send"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
