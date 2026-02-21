import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProfilePreview } from "@/components/ProfilePreview"

export default function TaskDetails() {
    const { id } = useParams()
    const { session } = useAuth()

    const [task, setTask] = useState<any>(null)
    const [applicants, setApplicants] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [pitch, setPitch] = useState("")
    const [applied, setApplied] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        const fetchDetails = async () => {
            if (!id) return

            try {
                // Fetch Task
                const { data: taskData, error: taskError } = await supabase
                    .from("tasks")
                    .select("*, profiles:client_id(full_name)")
                    .eq("id", id)
                    .single()

                if (taskError) throw taskError
                setTask(taskData)

                // Fetch Applications
                const { data: appData, error: appError } = await supabase
                    .from("applications")
                    .select("*, profiles:freelancer_id(full_name, reliability_score)")
                    .eq("task_id", id)

                if (appError) throw appError
                setApplicants(appData || [])

                // Check if current user already applied
                if (session?.user?.id) {
                    const hasApplied = appData?.some(app => app.freelancer_id === session.user.id)
                    setApplied(!!hasApplied)
                }
            } catch (err: any) {
                console.error("Error fetching task details:", err)
                setError("Task not found or failed to load.")
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()
    }, [id, session?.user?.id])

    const isClientOwner = session?.user?.id === task?.client_id

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pitch || !session?.user?.id || !task) return

        setActionLoading(true)
        try {
            const { error: applyError } = await supabase.from("applications").insert({
                task_id: task.id,
                freelancer_id: session.user.id,
                pitch_message: pitch
            })

            if (applyError) throw applyError

            setApplied(true)
            alert("Application sent successfully!")
        } catch (err: any) {
            console.error(err)
            alert("Failed to apply: " + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleAssign = async (appId: string, freelancerId: string) => {
        if (!confirm("Are you sure you want to assign this freelancer?")) return

        setActionLoading(true)
        try {
            // Update application status
            await supabase.from("applications").update({ status: 'ACCEPTED' }).eq('id', appId)
            // Update task status and assigned freelancer
            await supabase.from("tasks").update({
                status: 'ASSIGNED',
                assigned_freelancer_id: freelancerId
            }).eq('id', task.id)

            alert("Freelancer assigned successfully!")
            // Refresh
            window.location.reload()
        } catch (err: any) {
            console.error(err)
            alert("Failed to assign freelancer.")
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) return <div className="container py-20 text-center">Loading task details...</div>
    if (error || !task) return <div className="container py-20 text-center text-red-500">{error || "Task not found."}</div>

    return (
        <div className="container mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Task Information (Left Column) */}
            <div className="lg:col-span-2 space-y-6">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="secondary" className="capitalize">{task.category}</Badge>
                        <Badge variant={task.priority_level === 'urgent' ? 'destructive' : 'outline'} className="capitalize">{task.priority_level}</Badge>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{task.status}</Badge>
                    </div>

                    <h1 className="text-3xl font-bold">{task.title}</h1>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-4">
                        <span>Posted by <span className="font-semibold text-foreground">{task.profiles?.full_name || "Unknown"}</span></span>
                        {task.client_id && (
                            <ProfilePreview
                                userId={task.client_id}
                                trigger={<Button variant="ghost" size="sm" className="h-8 px-3">View profile</Button>}
                            />
                        )}
                        <span>•</span>
                        <span>Deadline: {new Date(task.deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
                    </div>
                </div>

                <div className="prose max-w-none">
                    <h3 className="text-xl font-semibold mb-2">Description</h3>
                    <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{task.description}</p>
                </div>

                {task.required_skills && task.required_skills.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold mb-2">Required Skills</h3>
                        <div className="flex flex-wrap gap-2">
                            {task.required_skills.map((tag: string) => (
                                <Badge variant="outline" key={tag}>{tag}</Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Sidebar (Right Column) */}
            <div className="space-y-6">
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="bg-primary/5 pb-4">
                        <CardDescription className="font-semibold text-primary">Budget</CardDescription>
                        <CardTitle className="text-4xl text-green-600">₹{task.budget}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {!session ? (
                            <div className="text-center space-y-4">
                                <p className="text-sm text-muted-foreground">Sign in to apply for this task.</p>
                                <Link to="/login"><Button className="w-full">Sign In</Button></Link>
                            </div>
                        ) : isClientOwner ? (
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                                <p className="font-medium">You posted this task.</p>
                                <p className="text-sm text-muted-foreground mt-1">Review your applicants below.</p>
                            </div>
                        ) : applied ? (
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
                                    <p className="font-medium">✨ Application Submitted!</p>
                                    <p className="text-sm mt-1">The client will review your pitch.</p>
                                </div>
                                <Link to={`/chat/${task.id}/${task.client_id}`}>
                                    <Button variant="outline" className="w-full">Message Client</Button>
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleApply} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Your Pitch</label>
                                    <Textarea
                                        placeholder="Why are you the best fit? How long will it take?"
                                        className="resize-none"
                                        value={pitch}
                                        onChange={(e) => setPitch(e.target.value)}
                                        required
                                        disabled={actionLoading}
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={actionLoading}>
                                    {actionLoading ? "Applying..." : "Apply for Job"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                {/* Client View: Applicants List */}
                {isClientOwner && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Applicants ({applicants.length})</h3>
                        <div className="space-y-4">
                            {applicants.map(app => (
                                <Card key={app.id}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarFallback>{app.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <CardTitle className="text-base">{app.profiles?.full_name}</CardTitle>
                                                    <CardDescription>⭐ {app.profiles?.reliability_score} Reliability</CardDescription>
                                                </div>
                                            </div>
                                            {app.status === 'ACCEPTED' && (
                                                <Badge className="bg-green-500">Hired</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-3">
                                        <p className="text-sm italic text-muted-foreground">"{app.pitch_message}"</p>
                                    </CardContent>
                                    <CardFooter>
                                        <div className="flex gap-2 w-full">
                                            <Link to={`/chat/${task.id}/${app.freelancer_id}`} className="w-full">
                                                <Button variant="outline" className="w-full">Chat</Button>
                                            </Link>
                                            <ProfilePreview
                                                userId={app.freelancer_id}
                                                trigger={<Button variant="ghost" className="w-full border">View profile</Button>}
                                            />
                                            {task.status === 'OPEN' && (
                                                <Button
                                                    onClick={() => handleAssign(app.id, app.freelancer_id)}
                                                    className="w-full"
                                                    disabled={actionLoading}
                                                >
                                                    Assign
                                                </Button>
                                            )}
                                        </div>
                                    </CardFooter>
                                </Card>
                            ))}
                            {applicants.length === 0 && (
                                <p className="text-sm text-muted-foreground border p-4 rounded-md text-center">No applicants yet.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
