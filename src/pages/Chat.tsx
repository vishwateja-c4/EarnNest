import { useState, useRef, useEffect } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import { ProfilePreview } from "@/components/ProfilePreview"

export default function Chat() {
    const { id: rawId, receiverId: rawReceiverId } = useParams()
    const taskId = rawId?.trim()
    const receiverId = rawReceiverId?.trim()
    const { session } = useAuth()

    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [taskInfo, setTaskInfo] = useState<any>(null)
    const [otherUser, setOtherUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    useEffect(() => {
        if (!session?.user?.id || !taskId) return

        const fetchChatData = async () => {
            // 1. Fetch Task Info
            const { data: taskData } = await supabase.from('tasks').select('*').eq('id', taskId).single()
            if (taskData) setTaskInfo(taskData)

            // Determine who we are chatting with
            let targetUserId = receiverId
            if (!targetUserId && taskData) {
                targetUserId = session.user.id === taskData.client_id ? taskData.assigned_freelancer_id : taskData.client_id
            }

            if (targetUserId) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', targetUserId).single()
                if (profile) setOtherUser({ id: targetUserId, name: profile.full_name })

                // 2. Fetch Messages between current user and target user for this task
                const { data: msgs } = await supabase.from('messages')
                    .select('*')
                    .eq('task_id', taskId)
                    .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${session.user.id})`)
                    .order('created_at', { ascending: true })

                if (msgs) setMessages(msgs)
            }
            setLoading(false)
        }

        fetchChatData()

        // 3. Realtime Subscription
        const channel = supabase.channel('public:messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` },
                (payload) => {
                    const newMsg = payload.new
                    if (
                        (newMsg.sender_id === session.user.id && newMsg.receiver_id === otherUser?.id) ||
                        (newMsg.sender_id === otherUser?.id && newMsg.receiver_id === session.user.id)
                    ) {
                        setMessages(prev => [...prev, newMsg])
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [taskId, receiverId, session?.user?.id, otherUser?.id])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !session?.user?.id || !otherUser?.id || !taskId) return

        const msgContent = newMessage;
        setNewMessage("") // Clear input immediately for UX

        const { error } = await supabase.from('messages').insert({
            task_id: taskId,
            sender_id: session.user.id,
            receiver_id: otherUser.id,
            content: msgContent
        })

        if (error) {
            console.error("Failed to send message", error)
            setNewMessage(msgContent) // Put message back in input if it failed to send
        }
    }

    if (loading) return <div className="p-8 text-center">Loading chat...</div>
    if (!otherUser) return <div className="p-8 text-center text-muted-foreground">Select a valid conversation to start chatting.</div>

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl h-[calc(100vh-8rem)]">
            <Card className="h-full flex flex-col shadow-lg border-primary/20">
                <CardHeader className="border-b bg-muted/30 pb-4">
                    <div className="flex items-center gap-4">
                        <Avatar>
                            <AvatarFallback className="bg-primary/20 text-primary">
                                {otherUser.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-lg">Chat with {otherUser.name}</CardTitle>
                            {taskInfo && <p className="text-sm text-green-600 font-medium">Task: {taskInfo.title}</p>}
                        </div>
                        {otherUser.id && (
                            <ProfilePreview
                                userId={otherUser.id}
                                trigger={<Button variant="ghost" size="sm" className="ml-auto">View profile</Button>}
                            />
                        )}
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
                    {messages.map((msg) => {
                        const isMe = msg.sender_id === session?.user?.id
                        return (
                            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"
                                    }`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"} text-right`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    {messages.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg bg-background">
                            No messages yet. Say hi!
                        </div>
                    )}
                    <div ref={bottomRef} />
                </CardContent>

                <div className="p-4 bg-background border-t mt-auto">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <Input
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    )
}
