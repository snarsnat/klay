import random

def magic_eight_ball():
    responses = [
        "It is certain.",
        "It is decidedly so.",
        "Without a doubt.",
        "Yes definitely.",
        "You may rely on it.",
        "As I see it, yes.",
        "Most likely.",
        "Outlook good.",
        "Yes.",
        "Signs point to yes.",
        "Reply hazy, try again.",
        "Ask again later.",
        "Better not tell you now.",
        "Cannot predict now.",
        "Concentrate and ask again.",
        "Don't count on it.",
        "My reply is no.",
        "My sources say no.",
        "Outlook not so good.",
        "Very doubtful."
    ]

    print("--- Magic 8-Ball ---")
    question = input("Ask a question: ")
    
    if not question.strip():
        print("You didn't ask a question!")
    else:
        print("Thinking...")
        # Adding a small delay for dramatic effect
        import time
        time.sleep(1)
        print("Magic 8-Ball says: " + random.choice(responses))

if __name__ == "__main__":
    magic_eight_ball()
