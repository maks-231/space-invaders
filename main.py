from dotenv import load_dotenv
import asyncio

from claude_agent_sdk import ClaudeAgentOptions, query

load_dotenv(override=True)

PROMPT = """Make a vanilla HTML + JS + CSS website for a game called "Space Invaders". Write the code in the current working directory including index.html"""

TOOLS=["Read", "Write", "Edit", "Bash", "Glob", "Grep"]

async def main():
    options = ClaudeAgentOptions(
        tools=TOOLS,
        model="sonnet",
        permission_mode="acceptEdits"
    )

    async for message in query(prompt=PROMPT, options=options): 
        print(message)

asyncio.run(main())