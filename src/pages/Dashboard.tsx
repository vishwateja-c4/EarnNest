import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wallet, Clock, Briefcase, Star, FileText } from "lucide-react"
import { Link } from "react-router-dom"
import { ProfilePreview } from "@/components/ProfilePreview"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"

export default function Dashboard() {
    const { session } = useAuth()

    const [walletBal, setWalletBal] = useState(0)
    const [escrowBal, setEscrowBal] = useState(0)
    const [score, setScore] = useState(0)

    const [activeAssignments, setActiveAssignments] = useState<any[]>([])
    const [pendingApps, setPendingApps] = useState<any[]>([])
    const [completedGigs, setCompletedGigs] = useState<any[]>([])

    const [actionRequiredTasks, setActionRequiredTasks] = useState<any[]>([])
    const [ongoingClientTasks, setOngoingClientTasks] = useState<any[]>([])
    const [completedClientTasks, setCompletedClientTasks] = useState<any[]>([])

    const [loading, setLoading] = useState(true)

    // Review Dialog State
    const [rating, setRating] = useState(0)
    const [taskToReview, setTaskToReview] = useState<string | null>(null)
    const [reviewFreelancerId, setReviewFreelancerId] = useState<string | null>(null)

    useEffect(() => {
        if (!session?.user?.id) return

        const fetchDashboardData = async () => {
            const uid = session.user.id

            // 1. Fetch Profile info (Score)
            const { data: profile } = await supabase.from('profiles').select('reliability_score').eq('id', uid).single()
            if (profile) setScore(profile.reliability_score || 0)

            // 2. Fetch Wallet
            const { data: wallet } = await supabase.from('wallets').select('available_balance, locked_balance').eq('user_id', uid).single()
            if (wallet) {
                setWalletBal(wallet.available_balance || 0)
                setEscrowBal(wallet.locked_balance || 0)
            }

            // 3. Freelancer: Active Assignments (and Submitted for review)
            const { data: assignments } = await supabase.from('tasks')
                .select('*, profiles:client_id(full_name)')
                .eq('assigned_freelancer_id', uid)
                .in('status', ['ASSIGNED', 'SUBMITTED'])
            if (assignments) setActiveAssignments(assignments)

            // 4. Freelancer: Pending Applications
            const { data: apps } = await supabase.from('applications')
                .select('*, tasks(title, client_id)')
                .eq('freelancer_id', uid)
                .eq('status', 'PENDING')
            if (apps) setPendingApps(apps)

            // 5. Freelancer: Completed Tasks
            const { data: fCompleted } = await supabase.from('tasks')
                .select('*, profiles!client_id(full_name)')
                .eq('assigned_freelancer_id', uid)
                .eq('status', 'COMPLETED')
                .order('created_at', { ascending: false })
            if (fCompleted) setCompletedGigs(fCompleted)

            // 6. Client: Ongoing Tasks (and Submitted)
            const { data: ongoingTasks } = await supabase.from('tasks')
                .select('*, profiles!assigned_freelancer_id(full_name)')
                .eq('client_id', uid)
                .in('status', ['ASSIGNED', 'SUBMITTED'])
            if (ongoingTasks) setOngoingClientTasks(ongoingTasks)

            // 7. Client: Completed Tasks
            const { data: cCompleted } = await supabase.from('tasks')
                .select('*, profiles!assigned_freelancer_id(full_name)')
                .eq('client_id', uid)
                .eq('status', 'COMPLETED')
                .order('created_at', { ascending: false })
            if (cCompleted) setCompletedClientTasks(cCompleted)

            // 8. Client: Action Required (Tasks you posted that have pending applications)
            const { data: pendingTaskApps } = await supabase.from('tasks')
                .select(`
id, title, created_at,
    applications(count)
        `)
                .eq('client_id', uid)
                .eq('status', 'OPEN')
                .eq('applications.status', 'PENDING')

            if (pendingTaskApps) {
                // Filter out tasks that have 0 pending apps
                const actionTasks = pendingTaskApps.filter((t: any) => t.applications[0]?.count > 0)
                setActionRequiredTasks(actionTasks)
            }

            setLoading(false)
        }

        fetchDashboardData()
    }, [session?.user?.id])

    const handleReviewSubmit = async () => {
        if (!taskToReview || !reviewFreelancerId || rating === 0) return

        try {
            // 1. Update Task Status
            const { error: taskError } = await supabase
                .from('tasks')
                .update({ status: 'COMPLETED' })
                .eq('id', taskToReview)

            if (taskError) throw taskError

            // 2 & 3. Update Freelancer Score & Count via RPC (bypassing RLS)
            const { error: profileError } = await supabase.rpc('update_freelancer_score', {
                p_freelancer_id: reviewFreelancerId,
                p_rating: rating
            })

            if (profileError) {
                console.error("Error updating profile score:", profileError)
                // Continue anyway to mark task complete, but log error
            }

            alert("Task marked as complete and review submitted!")

            // Update local states: move from ongoing to completed
            const completedTaskDetails = ongoingClientTasks.find(t => t.id === taskToReview)
            setOngoingClientTasks(prev => prev.filter(t => t.id !== taskToReview))

            if (completedTaskDetails) {
                setCompletedClientTasks(prev => [{ ...completedTaskDetails, status: 'COMPLETED' }, ...prev])
            }

            // Reset modal
            setRating(0)
            setTaskToReview(null)
            setReviewFreelancerId(null)

        } catch (err) {
            console.error("Failed to complete task:", err)
            alert("Failed to complete task.")
        }
    }

    const handleMarkSubmitted = async (taskId: string) => {
        try {
            const { error } = await supabase.from('tasks').update({ status: 'SUBMITTED' }).eq('id', taskId)
            if (error) throw error

            alert("Work submitted for review!")
            // Update local state
            setActiveAssignments(prev => prev.map(t => t.id === taskId ? { ...t, status: 'SUBMITTED' } : t))
        } catch (err) {
            console.error("Failed to submit task:", err)
            alert("Failed to submit work.")
        }
    }

    if (!session) return <div className="p-8 text-center">Please log in to view dashboard.</div>
    if (loading) return <div className="p-8 text-center">Loading dashboard...</div>

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Manage your EarnNest tasks and freelance work.</p>
                </div>
                <Link to="/tasks/create">
                    <Button size="lg">Post a New Task</Button>
                </Link>
            </div>

            {/* Global Wallet Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{walletBal}</div>
                        <p className="text-xs text-muted-foreground mt-1">Ready to withdraw or spend</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Locked in Escrow</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">₹{escrowBal}</div>
                        <p className="text-xs text-muted-foreground mt-1">Held securely for ongoing tasks</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reliability Score</CardTitle>
                        <Star className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{score} / 5.0</div>
                        <p className="text-xs text-muted-foreground mt-1">Official platform rating</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="freelancer" className="space-y-6">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="freelancer">Freelancer View</TabsTrigger>
                    <TabsTrigger value="client">Client View</TabsTrigger>
                </TabsList>

                <TabsContent value="freelancer" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Active Assignments */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="h-5 w-5 text-blue-500" />
                                    Active Assignments ({activeAssignments.length})
                                </CardTitle>
                                <CardDescription>Work you are currently doing for clients.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeAssignments.map(task => (
                                    <div key={task.id} className="border rounded-lg p-4 flex justify-between items-center bg-muted/20">
                                        <div>
                                            <h4 className="font-semibold">{task.title}</h4>
                                            <p className="text-sm text-muted-foreground">Client: {task.profiles?.full_name} • Due: {new Date(task.deadline).toLocaleDateString()}</p>
                                            {task.client_id && (
                                                <ProfilePreview
                                                    userId={task.client_id}
                                                    trigger={<Button variant="ghost" size="sm" className="h-8 px-2">View client profile</Button>}
                                                />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="font-bold text-green-600">₹{task.budget}</div>
                                            <Badge className="mt-1" variant={task.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                                                {task.status === 'SUBMITTED' ? 'Under Review' : 'In Progress'}
                                            </Badge>
                                            <div className="flex gap-2">
                                                {task.client_id ? (
                                                    <Link to={`/chat/${task.id}/${task.client_id}`}>
                                                        <Button size="sm" variant="outline">Message Client</Button>
                                                    </Link>
                                                ) : (
                                                    <Link to={`/chat/${task.id}`}>
                                                        <Button size="sm" variant="outline">Message Client</Button>
                                                    </Link>
                                                )}
                                                {task.status === 'ASSIGNED' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMarkSubmitted(task.id)}
                                                    >
                                                        Submit Work
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {activeAssignments.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No active assignments.</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Pending Applications */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-orange-500" />
                                    Pending Applications ({pendingApps.length})
                                </CardTitle>
                                <CardDescription>Waiting for client approval.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {pendingApps.map(app => (
                                    <div key={app.id} className="border rounded-lg p-4 flex justify-between items-center opacity-80">
                                        <div>
                                            <h4 className="font-semibold">{app.tasks?.title || "Unknown Task"}</h4>
                                            <p className="text-sm text-muted-foreground">Applied {new Date(app.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant="outline">Pending</Badge>
                                            {app.tasks?.client_id && (
                                                <ProfilePreview
                                                    userId={app.tasks.client_id}
                                                    trigger={<Button size="sm" variant="ghost">View client</Button>}
                                                />
                                            )}
                                            {app.tasks?.client_id && (
                                                <Link to={`/chat/${app.task_id}/${app.tasks.client_id}`}>
                                                    <Button size="sm" variant="ghost">Message Client</Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {pendingApps.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No pending applications.</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Completed Freelancer Gigs */}
                        <Card className="opacity-75">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-green-500" />
                                    Completed Gigs ({completedGigs.length})
                                </CardTitle>
                                <CardDescription>Tasks you have successfully finished.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {completedGigs.map(task => (
                                    <div key={task.id} className="border rounded-lg p-4 flex justify-between items-center bg-green-50/50 dark:bg-green-900/10">
                                        <div>
                                            <h4 className="font-semibold">{task.title}</h4>
                                            <p className="text-sm text-muted-foreground">Client: {task.profiles?.full_name}</p>
                                            {task.client_id && (
                                                <ProfilePreview
                                                    userId={task.client_id}
                                                    trigger={<Button variant="ghost" size="sm" className="h-8 px-2">View client</Button>}
                                                />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant="outline" className="text-green-600 border-green-200">Completed</Badge>
                                            <div className="font-bold text-green-600 text-sm">₹{task.budget} Earned</div>
                                        </div>
                                    </div>
                                ))}
                                {completedGigs.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No completed gigs yet.</div>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </TabsContent>

                <TabsContent value="client" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Posted Tasks requiring action */}
                        <Card className="border-primary/50 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Star className="h-5 w-5 text-yellow-500" />
                                    Action Required ({actionRequiredTasks.length})
                                </CardTitle>
                                <CardDescription>Review applicants for your posted tasks.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {actionRequiredTasks.map(task => (
                                    <div key={task.id} className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-semibold text-lg">{task.title}</h4>
                                                <p className="text-sm text-muted-foreground">Posted {new Date(task.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <Badge variant="destructive">{task.applications[0]?.count} New Applicants</Badge>
                                        </div>
                                        <Link to={`/tasks/${task.id}`}>
                                            <Button className="w-full" variant="default">Review Applicants</Button>
                                        </Link>
                                    </div>
                                ))}
                                {actionRequiredTasks.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No action required on any tasks.</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Ongoing Client Tasks */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-blue-500" />
                                    Ongoing Tasks ({ongoingClientTasks.length})
                                </CardTitle>
                                <CardDescription>Tasks currently being done by freelancers.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {ongoingClientTasks.map(task => (
                                    <div key={task.id} className="border rounded-lg p-4 flex justify-between items-center bg-muted/20">
                                        <div>
                                            <h4 className="font-semibold">{task.title}</h4>
                                            <p className="text-sm text-muted-foreground">Freelancer: {task.profiles?.full_name} • Due: {new Date(task.deadline).toLocaleDateString()}</p>
                                            {task.assigned_freelancer_id && (
                                                <ProfilePreview
                                                    userId={task.assigned_freelancer_id}
                                                    trigger={<Button variant="ghost" size="sm" className="h-8 px-2">View freelancer</Button>}
                                                />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant={task.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                                                {task.status === 'SUBMITTED' ? 'Pending Review' : 'Assigned'}
                                            </Badge>
                                            <div className="flex gap-2">
                                                <Link to={`/chat/${task.id}`}>
                                                    <Button size="sm" variant="outline">Message</Button>
                                                </Link>
                                                {task.status === 'SUBMITTED' && (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button size="sm" onClick={() => {
                                                                setTaskToReview(task.id)
                                                                setReviewFreelancerId(task.assigned_freelancer_id)
                                                            }}>Review & Complete</Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Review Work</DialogTitle>
                                                                <DialogDescription>
                                                                    Rate {task.profiles?.full_name}'s work. This will release the payment and mark the task as complete.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="py-6 flex flex-col items-center space-y-4">
                                                                <h4 className="font-medium text-lg">Leave a Rating (1-5 Stars)</h4>
                                                                <div className="flex gap-2">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <Button
                                                                            key={star}
                                                                            variant={rating >= star ? 'default' : 'outline'}
                                                                            size="icon"
                                                                            className="rounded-full w-12 h-12"
                                                                            onClick={() => setRating(star)}
                                                                        >
                                                                            <Star className={`h-6 w-6 ${rating >= star ? 'fill-current' : ''}`} />
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <DialogFooter>
                                                                <Button
                                                                    onClick={handleReviewSubmit}
                                                                    disabled={rating === 0}
                                                                    className="w-full"
                                                                >
                                                                    Confirm Completion
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {ongoingClientTasks.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No ongoing tasks.</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Completed Client Tasks */}
                        <Card className="opacity-75">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-green-500" />
                                    Completed Tasks ({completedClientTasks.length})
                                </CardTitle>
                                <CardDescription>Tasks that have been successfully finished and paid.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {completedClientTasks.map(task => (
                                    <div key={task.id} className="border rounded-lg p-4 flex justify-between items-center bg-green-50/50 dark:bg-green-900/10">
                                        <div>
                                            <h4 className="font-semibold">{task.title}</h4>
                                            <p className="text-sm text-muted-foreground">Completed by: {task.profiles?.full_name}</p>
                                            {task.assigned_freelancer_id && (
                                                <ProfilePreview
                                                    userId={task.assigned_freelancer_id}
                                                    trigger={<Button variant="ghost" size="sm" className="h-8 px-2">View freelancer</Button>}
                                                />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant="outline" className="text-green-600 border-green-200">Completed</Badge>
                                            <div className="font-bold text-green-600 text-sm">₹{task.budget} Paid</div>
                                        </div>
                                    </div>
                                ))}
                                {completedClientTasks.length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No completed tasks yet.</div>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </TabsContent>
            </Tabs >
        </div >
    )
}
